package data

import (
	"context"
	"database/sql"
	"time"

	"github.com/lib/pq"
)

type MuscleVolume struct {
	MuscleID   int64   `json:"muscle_id"`
	MuscleName string  `json:"muscle_name"`
	BodyPart   string  `json:"body_part"`
	Sets       float64 `json:"sets"` // primary=1, secondary=0.5
}

type BodyPartVolume struct {
	BodyPart   string         `json:"body_part"`
	TotalSets  float64        `json:"total_sets"`
	SubMuscles []MuscleVolume `json:"sub_muscles"`
}

type VolumeModel struct {
	DB *sql.DB
}

// GetMesocycleVolume returns volume per muscle for a mesocycle.
// Primary muscles count as 1 set per set performed, secondary as 0.5.
func (m VolumeModel) GetMesocycleVolume(userID, mesocycleID int64) ([]BodyPartVolume, error) {
	query := `
		SELECT wset.exercise_id, mu.id, mu.name, mu.body_part::text, em.target_type::text,
		       COUNT(wset.id) as set_count
		FROM workout_sets wset
		JOIN workout_sessions ws ON wset.workout_session_id = ws.id
		JOIN exercise_muscles em ON wset.exercise_id = em.exercise_id
		JOIN muscles mu ON em.muscle_id = mu.id
		WHERE ws.user_id = $1 AND ws.mesocycle_id = $2 AND wset.recorded = true
		GROUP BY wset.exercise_id, mu.id, mu.name, mu.body_part, em.target_type
		ORDER BY mu.body_part, mu.name`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID, mesocycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	muscleMap := make(map[int64]*MuscleVolume)
	var muscleOrder []int64

	type exBP struct {
		exerciseID int64
		bodyPart   string
	}
	bestType := make(map[exBP]string)
	exSets := make(map[exBP]int)

	for rows.Next() {
		var exerciseID, muscleID int64
		var name, bodyPart, targetType string
		var setCount int

		err := rows.Scan(&exerciseID, &muscleID, &name, &bodyPart, &targetType, &setCount)
		if err != nil {
			return nil, err
		}

		multiplier := 1.0
		if targetType == "secondary" {
			multiplier = 0.5
		}

		if mv, ok := muscleMap[muscleID]; ok {
			mv.Sets += float64(setCount) * multiplier
		} else {
			muscleOrder = append(muscleOrder, muscleID)
			muscleMap[muscleID] = &MuscleVolume{
				MuscleID:   muscleID,
				MuscleName: name,
				BodyPart:   bodyPart,
				Sets:       float64(setCount) * multiplier,
			}
		}

		key := exBP{exerciseID, bodyPart}
		if cur, ok := bestType[key]; !ok || (cur == "secondary" && targetType == "primary") {
			bestType[key] = targetType
		}
		if exSets[key] < setCount {
			exSets[key] = setCount
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	bodyPartSets := make(map[string]float64)
	for key, tt := range bestType {
		multiplier := 1.0
		if tt == "secondary" {
			multiplier = 0.5
		}
		bodyPartSets[key.bodyPart] += float64(exSets[key]) * multiplier
	}

	return groupByBodyPart(muscleMap, muscleOrder, bodyPartSets), nil
}

type ExerciseSetsInput struct {
	ExerciseID int64 `json:"exercise_id"`
	Sets       int   `json:"sets"`
}

// PreviewVolume computes projected volume per muscle group for a given set of exercises.
func (m VolumeModel) PreviewVolume(exercises []ExerciseSetsInput) ([]BodyPartVolume, error) {
	if len(exercises) == 0 {
		return nil, nil
	}

	// Accumulate requested sets per exercise so repeated lifts across days contribute fully.
	ids := make([]int64, 0, len(exercises))
	setsMap := make(map[int64]int)
	for _, e := range exercises {
		if _, ok := setsMap[e.ExerciseID]; !ok {
			ids = append(ids, e.ExerciseID)
		}
		setsMap[e.ExerciseID] += e.Sets
	}

	// Query all muscle mappings for these exercises
	query := `
		SELECT em.exercise_id, mu.id, mu.name, mu.body_part::text, em.target_type::text
		FROM exercise_muscles em
		JOIN muscles mu ON em.muscle_id = mu.id
		WHERE em.exercise_id = ANY($1)
		ORDER BY mu.body_part, mu.name`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	muscleMap := make(map[int64]*MuscleVolume)
	var muscleOrder []int64

	type exBP struct {
		exerciseID int64
		bodyPart   string
	}
	bestType := make(map[exBP]string)

	for rows.Next() {
		var exerciseID, muscleID int64
		var name, bodyPart, targetType string

		err := rows.Scan(&exerciseID, &muscleID, &name, &bodyPart, &targetType)
		if err != nil {
			return nil, err
		}

		multiplier := 1.0
		if targetType == "secondary" {
			multiplier = 0.5
		}

		sets := float64(setsMap[exerciseID]) * multiplier

		if mv, ok := muscleMap[muscleID]; ok {
			mv.Sets += sets
		} else {
			muscleOrder = append(muscleOrder, muscleID)
			muscleMap[muscleID] = &MuscleVolume{
				MuscleID:   muscleID,
				MuscleName: name,
				BodyPart:   bodyPart,
				Sets:       sets,
			}
		}

		key := exBP{exerciseID, bodyPart}
		if cur, ok := bestType[key]; !ok || (cur == "secondary" && targetType == "primary") {
			bestType[key] = targetType
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	bodyPartSets := make(map[string]float64)
	for key, tt := range bestType {
		multiplier := 1.0
		if tt == "secondary" {
			multiplier = 0.5
		}
		bodyPartSets[key.bodyPart] += float64(setsMap[key.exerciseID]) * multiplier
	}

	return groupByBodyPart(muscleMap, muscleOrder, bodyPartSets), nil
}

func groupByBodyPart(muscleMap map[int64]*MuscleVolume, muscleOrder []int64, bodyPartSets map[string]float64) []BodyPartVolume {
	bodyPartMap := make(map[string]*BodyPartVolume)
	var bpOrder []string

	for _, mid := range muscleOrder {
		mv := muscleMap[mid]
		bp, ok := bodyPartMap[mv.BodyPart]
		if !ok {
			bpOrder = append(bpOrder, mv.BodyPart)
			bp = &BodyPartVolume{BodyPart: mv.BodyPart}
			bodyPartMap[mv.BodyPart] = bp
		}
		bp.SubMuscles = append(bp.SubMuscles, *mv)
	}

	var result []BodyPartVolume
	for _, bpName := range bpOrder {
		bpv := bodyPartMap[bpName]
		bpv.TotalSets = bodyPartSets[bpName]
		result = append(result, *bpv)
	}
	return result
}

// GetWeeklyVolume returns volume broken down by week for a mesocycle.
func (m VolumeModel) GetWeeklyVolume(userID, mesocycleID int64) ([]WeeklyVolumeData, error) {
	query := `
		SELECT
			date_trunc('week', ws.performed_at) as week_start,
			wset.exercise_id,
			mu.body_part::text,
			em.target_type::text,
			COUNT(DISTINCT wset.id) as set_count
		FROM workout_sets wset
		JOIN workout_sessions ws ON wset.workout_session_id = ws.id
		JOIN exercise_muscles em ON wset.exercise_id = em.exercise_id
		JOIN muscles mu ON em.muscle_id = mu.id
		WHERE ws.user_id = $1 AND ws.mesocycle_id = $2 AND wset.recorded = true
		GROUP BY week_start, wset.exercise_id, mu.body_part, em.target_type
		ORDER BY week_start, mu.body_part`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID, mesocycleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type weekExBP struct {
		weekStart  time.Time
		exerciseID int64
		bodyPart   string
	}
	bestType := make(map[weekExBP]string)
	exSets := make(map[weekExBP]int)
	var weekOrder []time.Time
	weekSeen := make(map[time.Time]bool)

	for rows.Next() {
		var weekStart time.Time
		var exerciseID int64
		var bodyPart, targetType string
		var setCount int

		err := rows.Scan(&weekStart, &exerciseID, &bodyPart, &targetType, &setCount)
		if err != nil {
			return nil, err
		}

		if !weekSeen[weekStart] {
			weekSeen[weekStart] = true
			weekOrder = append(weekOrder, weekStart)
		}

		key := weekExBP{weekStart, exerciseID, bodyPart}
		if cur, ok := bestType[key]; !ok || (cur == "secondary" && targetType == "primary") {
			bestType[key] = targetType
		}
		if exSets[key] < setCount {
			exSets[key] = setCount
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	weekMap := make(map[time.Time]map[string]float64)
	for key, tt := range bestType {
		multiplier := 1.0
		if tt == "secondary" {
			multiplier = 0.5
		}
		if weekMap[key.weekStart] == nil {
			weekMap[key.weekStart] = make(map[string]float64)
		}
		weekMap[key.weekStart][key.bodyPart] += float64(exSets[key]) * multiplier
	}

	var result []WeeklyVolumeData
	for _, week := range weekOrder {
		wv := WeeklyVolumeData{
			WeekStart: week,
			BodyParts: weekMap[week],
		}
		result = append(result, wv)
	}
	return result, nil
}

type WeeklyVolumeData struct {
	WeekStart time.Time          `json:"week_start"`
	BodyParts map[string]float64 `json:"body_parts"`
}

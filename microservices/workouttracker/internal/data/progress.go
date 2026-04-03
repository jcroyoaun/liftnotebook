package data

import (
	"context"
	"database/sql"
	"math"
	"time"
)

type E1RMDataPoint struct {
	Date        time.Time `json:"date"`
	SessionID   int64     `json:"session_id"`
	Weight      float64   `json:"weight"`
	Reps        int       `json:"reps"`
	RIR         *int      `json:"rir,omitempty"`
	EpleyE1RM   float64   `json:"epley_e1rm"`
	BrzyckiE1RM float64   `json:"brzycki_e1rm"`
	AvgE1RM     float64   `json:"avg_e1rm"`
}

type ProgressModel struct {
	DB *sql.DB
}

// CalcEpley: weight * (1 + reps/30)
func CalcEpley(weight float64, reps int) float64 {
	if reps == 1 {
		return weight
	}
	return weight * (1.0 + float64(reps)/30.0)
}

// CalcBrzycki: weight * 36 / (37 - reps)
func CalcBrzycki(weight float64, reps int) float64 {
	if reps == 1 {
		return weight
	}
	if reps >= 37 {
		return weight * 36.0 / 1.0
	}
	return weight * 36.0 / (37.0 - float64(reps))
}

// GetE1RMHistory returns e1RM progression for an exercise.
// For each session, it takes the best set (highest e1RM).
func (m ProgressModel) GetE1RMHistory(userID, exerciseID int64) ([]E1RMDataPoint, error) {
	query := `
		SELECT ws2.performed_at, ws2.id, wset.weight, wset.reps, wset.rir
		FROM workout_sets wset
		JOIN workout_sessions ws2 ON wset.workout_session_id = ws2.id
		WHERE ws2.user_id = $1 AND wset.exercise_id = $2 AND wset.recorded = true
		ORDER BY ws2.performed_at, wset.set_number`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID, exerciseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Group by session, take best e1RM per session
	type setData struct {
		date      time.Time
		sessionID int64
		weight    float64
		reps      int
		rir       *int
	}

	sessionBest := make(map[int64]*setData)
	var sessionOrder []int64

	for rows.Next() {
		var sd setData
		err := rows.Scan(&sd.date, &sd.sessionID, &sd.weight, &sd.reps, &sd.rir)
		if err != nil {
			return nil, err
		}

		epley := CalcEpley(sd.weight, sd.reps)
		existing, ok := sessionBest[sd.sessionID]
		if !ok {
			sessionOrder = append(sessionOrder, sd.sessionID)
			sessionBest[sd.sessionID] = &sd
		} else {
			existingEpley := CalcEpley(existing.weight, existing.reps)
			if epley > existingEpley {
				sessionBest[sd.sessionID] = &sd
			}
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	var points []E1RMDataPoint
	for _, sid := range sessionOrder {
		sd := sessionBest[sid]
		epley := CalcEpley(sd.weight, sd.reps)
		brzycki := CalcBrzycki(sd.weight, sd.reps)
		avg := math.Round((epley+brzycki)/2*100) / 100

		points = append(points, E1RMDataPoint{
			Date:        sd.date,
			SessionID:   sd.sessionID,
			Weight:      sd.weight,
			Reps:        sd.reps,
			RIR:         sd.rir,
			EpleyE1RM:   math.Round(epley*100) / 100,
			BrzyckiE1RM: math.Round(brzycki*100) / 100,
			AvgE1RM:     avg,
		})
	}

	return points, nil
}

package data

import (
	"database/sql"
	"errors"
)

var (
	ErrRecordNotFound = errors.New("record not found")
	ErrEditConflict   = errors.New("edit conflict")
)

type Models struct {
	Users           UserModel
	Mesocycles      MesocycleModel
	TrainingDays    TrainingDayModel
	WorkoutSessions WorkoutSessionModel
	WorkoutSets     WorkoutSetModel
	Exercises       ExerciseReader
	Progress        ProgressModel
	Volume          VolumeModel
}

func NewModels(db *sql.DB) Models {
	return Models{
		Users:           UserModel{DB: db},
		Mesocycles:      MesocycleModel{DB: db},
		TrainingDays:    TrainingDayModel{DB: db},
		WorkoutSessions: WorkoutSessionModel{DB: db},
		WorkoutSets:     WorkoutSetModel{DB: db},
		Exercises:       ExerciseReader{DB: db},
		Progress:        ProgressModel{DB: db},
		Volume:          VolumeModel{DB: db},
	}
}

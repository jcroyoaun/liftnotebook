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
	Tokens          TokenModel
	Mesocycles      MesocycleModel
	TrainingDays    TrainingDayModel
	Templates       TemplateModel
	WorkoutSessions WorkoutSessionModel
	WorkoutSets     WorkoutSetModel
	Exercises       ExerciseReader
	Progress        ProgressModel
	Progression     ProgressionModel
	Volume          VolumeModel
}

func NewModels(db *sql.DB) Models {
	return Models{
		Users:           UserModel{DB: db},
		Tokens:          TokenModel{DB: db},
		Mesocycles:      MesocycleModel{DB: db},
		TrainingDays:    TrainingDayModel{DB: db},
		Templates:       TemplateModel{DB: db},
		WorkoutSessions: WorkoutSessionModel{DB: db},
		WorkoutSets:     WorkoutSetModel{DB: db},
		Exercises:       ExerciseReader{DB: db},
		Progress:        ProgressModel{DB: db},
		Progression:     ProgressionModel{DB: db},
		Volume:          VolumeModel{DB: db},
	}
}

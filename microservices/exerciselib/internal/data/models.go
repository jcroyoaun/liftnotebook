package data

import (
	"database/sql"
	"errors"
)

// Define a custom ErrRecordNotFound error. We'll return this from our Get() method when
// looking up a movie that doesn't exist in our database. Also an ErrEditConflict for optimistic locking
// (race conditions)

var (
	ErrRecordNotFound = errors.New("record not found")
	ErrEditConflict   = errors.New("edit conflict")
)

// Create a Models struct which wraps the MovieModel. We'll add other models to this,
// like a UserModel and PermissionModel, as our build progresses.
type Models struct {
	Exercises        ExerciseModel
	MovementPatterns MovementPatternModel
	Muscles          MuscleModel
	Users            UserModel
}

// For ease of use, we also add a New() method which returns a Models struct containing
// the initialized MovieModel.
func NewModels(db *sql.DB) Models {
	return Models{
		Exercises:        ExerciseModel{DB: db},
		MovementPatterns: MovementPatternModel{DB: db},
		Muscles:          MuscleModel{DB: db},
		Users:            UserModel{DB: db},
	}
}

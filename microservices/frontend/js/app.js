/**
 * Exercise Library Application
 * Modern frontend for exercise management with Alpine.js
 */

// Add cache busting for development
const cacheBuster = new Date().getTime();

function exerciseApp() {
    return {
        // State
        loading: true,
        loadingExercises: false,
        modalOpen: false,
        currentExercise: null,
        
        // Data
        exercises: [],
        muscles: [],
        movementPatterns: [],
        bodyParts: [],
        exerciseTypes: ['compound', 'isolation'],
        
        // Stats
        stats: {
            totalExercises: 0,
            totalMuscles: 0
        },
        
        // Filters
        filters: {
            name: '',
            type: '',
            movement_pattern: '',
            body_part: '',
            muscle_id: '',
            movement_pattern_id: ''
        },
        
        // Form data
        formData: {
            name: '',
            type: '',
            movement_pattern_id: '',
            primary_muscles: [],
            secondary_muscles: []
        },
        
        // Methods
        async init() {
            console.log('Initializing app...', { cacheBuster });
            try {
                await this.loadInitialData();
                await this.loadExercises();
            } catch (error) {
                console.error('Init error:', error);
                this.showError('Failed to load initial data');
            } finally {
                this.loading = false;
            }
        },
        
        async loadInitialData() {
            try {
                // Load muscles
                const musclesResponse = await fetch(`/v1/muscles?_=${cacheBuster}`);
                const musclesData = await musclesResponse.json();
                this.muscles = musclesData.muscles || [];
                this.stats.totalMuscles = this.muscles.length;
                
                // Extract body parts
                const bodyPartsSet = new Set(this.muscles.map(m => m.body_part));
                this.bodyParts = Array.from(bodyPartsSet).sort();
                
                // Load movement patterns
                const patternsResponse = await fetch(`/v1/movement-patterns?_=${cacheBuster}`);
                const patternsData = await patternsResponse.json();
                this.movementPatterns = patternsData.movement_patterns || [];
            } catch (error) {
                console.error('Error loading initial data:', error);
                throw error;
            }
        },
        
        async loadExercises() {
            this.loadingExercises = true;
            try {
                const params = new URLSearchParams();
                Object.entries(this.filters).forEach(([key, value]) => {
                    if (value) params.append(key, value);
                });
                params.append('_', cacheBuster);
                
                const response = await fetch(`/v1/exercises?${params}`);
                const data = await response.json();
                this.exercises = data.exercises || [];
                this.stats.totalExercises = data.metadata?.total_records || this.exercises.length;
            } catch (error) {
                console.error('Error loading exercises:', error);
                this.showError('Failed to load exercises');
            } finally {
                this.loadingExercises = false;
            }
        },
        
        applyFilters() {
            this.loadExercises();
        },
        
        resetFilters() {
            this.filters = {
                name: '',
                type: '',
                movement_pattern: '',
                body_part: '',
                muscle_id: '',
                movement_pattern_id: ''
            };
            this.loadExercises();
        },
        
        filterByMuscle(muscle) {
            this.filters.muscle_id = muscle.id;
            this.filters.body_part = muscle.body_part;
            this.loadExercises();
        },
        
        openModal(exercise = null) {
            this.currentExercise = exercise;
            if (exercise) {
                this.formData = {
                    name: exercise.name,
                    type: exercise.type,
                    movement_pattern_id: exercise.movement_pattern_id,
                    primary_muscles: exercise.primary_muscles?.map(m => m.id) || [],
                    secondary_muscles: exercise.secondary_muscles?.map(m => m.id) || []
                };
            } else {
                this.formData = {
                    name: '',
                    type: '',
                    movement_pattern_id: '',
                    primary_muscles: [],
                    secondary_muscles: []
                };
            }
            this.modalOpen = true;
        },
        
        closeModal() {
            this.modalOpen = false;
            this.currentExercise = null;
        },
        
        editExercise(exercise) {
            this.openModal(exercise);
        },
        
        async saveExercise() {
            try {
                const url = this.currentExercise 
                    ? `/v1/exercises/${this.currentExercise.id}` 
                    : '/v1/exercises';
                
                const method = this.currentExercise ? 'PATCH' : 'POST';
                
                const payload = {
                    name: this.formData.name,
                    type: this.formData.type,
                    movement_pattern_id: parseInt(this.formData.movement_pattern_id)
                };
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to save exercise');
                }
                
                this.showSuccess(this.currentExercise 
                    ? 'Exercise updated successfully!' 
                    : 'Exercise created successfully!');
                
                this.closeModal();
                await this.loadExercises();
            } catch (error) {
                console.error('Save error:', error);
                this.showError(error.message);
            }
        },
        
        async deleteExercise(id) {
            if (!confirm('Are you sure you want to delete this exercise?')) return;
            
            try {
                const response = await fetch(`/v1/exercises/${id}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete exercise');
                }
                
                this.showSuccess('Exercise deleted successfully!');
                await this.loadExercises();
            } catch (error) {
                console.error('Delete error:', error);
                this.showError(error.message);
            }
        },
        
        // Muscle management methods
        addMuscle(event, type) {
            const muscleId = parseInt(event.target.value);
            if (!muscleId) return;
            
            if (type === 'primary') {
                if (!this.formData.primary_muscles.includes(muscleId)) {
                    this.formData.primary_muscles.push(muscleId);
                }
            } else {
                if (!this.formData.secondary_muscles.includes(muscleId)) {
                    this.formData.secondary_muscles.push(muscleId);
                }
            }
            
            // Reset the select
            event.target.value = '';
        },
        
        removeMuscle(muscleId, type) {
            if (type === 'primary') {
                this.formData.primary_muscles = this.formData.primary_muscles.filter(id => id !== muscleId);
            } else {
                this.formData.secondary_muscles = this.formData.secondary_muscles.filter(id => id !== muscleId);
            }
        },
        
        // Utilities
        capitalizeFirst(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        showSuccess(message) {
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top",
                position: "right",
                style: {
                    background: "linear-gradient(to right, #10B981, #059669)",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "500"
                }
            }).showToast();
        },
        
        showError(message) {
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top",
                position: "right",
                style: {
                    background: "linear-gradient(to right, #EF4444, #DC2626)",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "500"
                }
            }).showToast();
        }
    };
} 
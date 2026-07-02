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
        adminKey: localStorage.getItem('adminKey') || '',
        
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
            console.log('🚀 Initializing app...', { cacheBuster });
            console.log('🚀 Alpine.js version:', window.Alpine?.version || 'Not found');
            
            try {
                await this.loadInitialData();
                await this.loadExercises();
                console.log('✅ App initialization completed successfully');
            } catch (error) {
                console.error('❌ Init error:', error);
                this.showError('Failed to load initial data');
            } finally {
                this.loading = false;
                console.log('🚀 Loading state set to false');
            }
        },
        
        async loadInitialData() {
            try {
                console.log('🔄 Loading muscles...');
                // Load muscles
                const musclesResponse = await fetch(`/v1/muscles?_=${cacheBuster}`);
                console.log('🔄 Muscles response status:', musclesResponse.status);
                
                const musclesData = await musclesResponse.json();
                console.log('🔄 Muscles data received:', musclesData);
                
                this.muscles = musclesData.muscles || [];
                this.stats.totalMuscles = this.muscles.length;
                
                console.log('🔄 Processed muscles:', this.muscles.length);
                console.log('🔄 First few muscles:', this.muscles.slice(0, 3));
                
                // Extract body parts
                const bodyPartsSet = new Set(this.muscles.map(m => m.body_part));
                this.bodyParts = Array.from(bodyPartsSet).sort();
                
                console.log('🔄 Body parts extracted:', this.bodyParts);
                
                console.log('🔄 Loading movement patterns...');
                // Load movement patterns
                const patternsResponse = await fetch(`/v1/movement-patterns?_=${cacheBuster}`);
                console.log('🔄 Patterns response status:', patternsResponse.status);
                
                const patternsData = await patternsResponse.json();
                console.log('🔄 Patterns data received:', patternsData);
                
                this.movementPatterns = patternsData.movement_patterns || [];
                console.log('🔄 Processed movement patterns:', this.movementPatterns.length);
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
            console.log('🔄 Opening modal for:', exercise ? 'edit' : 'create');
            console.log('🔄 Current modal state:', this.modalOpen);
            console.log('🔄 Available muscles:', this.muscles.length);
            console.log('🔄 Available movement patterns:', this.movementPatterns.length);
            
            this.currentExercise = exercise;
            if (exercise) {
                console.log('🔄 Editing exercise:', exercise);
                this.formData = {
                    name: exercise.name,
                    type: exercise.type,
                    movement_pattern_id: exercise.movement_pattern_id,
                    primary_muscles: exercise.primary_muscles?.map(m => m.id) || [],
                    secondary_muscles: exercise.secondary_muscles?.map(m => m.id) || []
                };
            } else {
                console.log('🔄 Creating new exercise');
                this.formData = {
                    name: '',
                    type: '',
                    movement_pattern_id: '',
                    primary_muscles: [],
                    secondary_muscles: []
                };
            }
            
            this.modalOpen = true;
            console.log('🔄 Modal opened, new state:', this.modalOpen);
            console.log('🔄 Form data:', this.formData);
        },
        
        closeModal() {
            this.modalOpen = false;
            this.currentExercise = null;
        },
        
        editExercise(exercise) {
            this.openModal(exercise);
        },
        
        // Write endpoints require the admin API key (X-Admin-Key header).
        ensureAdminKey() {
            if (!this.adminKey) {
                this.promptAdminKey();
            }
            return this.adminKey;
        },

        promptAdminKey() {
            const key = prompt('Enter the admin API key:');
            if (key) {
                this.adminKey = key;
                localStorage.setItem('adminKey', key);
            }
        },

        handleUnauthorized() {
            this.adminKey = '';
            localStorage.removeItem('adminKey');
            this.showError('Admin key rejected. Click the key icon to set it and try again.');
        },

        async saveExercise() {
            try {
                if (!this.ensureAdminKey()) return;

                const url = this.currentExercise
                    ? `/v1/exercises/${this.currentExercise.id}`
                    : '/v1/exercises';

                const method = this.currentExercise ? 'PATCH' : 'POST';

                const payload = {
                    name: this.formData.name,
                    type: this.formData.type,
                    movement_pattern_id: parseInt(this.formData.movement_pattern_id),
                    primary_muscles: this.formData.primary_muscles,
                    secondary_muscles: this.formData.secondary_muscles
                };

                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Key': this.adminKey
                    },
                    body: JSON.stringify(payload)
                });

                if (response.status === 401) {
                    this.handleUnauthorized();
                    return;
                }

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
                if (!this.ensureAdminKey()) return;

                const response = await fetch(`/v1/exercises/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'X-Admin-Key': this.adminKey
                    }
                });

                if (response.status === 401) {
                    this.handleUnauthorized();
                    return;
                }

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
            console.log('🔥 addMuscle called:', { type, selectedValue: event.target.value });
            console.log('🔥 Available muscles:', this.muscles.length);
            console.log('🔥 Current formData:', this.formData);
            
            const muscleId = parseInt(event.target.value);
            console.log('🔥 Parsed muscleId:', muscleId);
            
            if (!muscleId) {
                console.log('❌ No valid muscle ID selected');
                return;
            }
            
            const selectedMuscle = this.muscles.find(m => m.id === muscleId);
            console.log('🔥 Selected muscle:', selectedMuscle);
            
            if (type === 'primary') {
                if (!this.formData.primary_muscles.includes(muscleId)) {
                    this.formData.primary_muscles.push(muscleId);
                    console.log('✅ Added to primary muscles:', this.formData.primary_muscles);
                } else {
                    console.log('⚠️ Muscle already in primary list');
                }
            } else {
                if (!this.formData.secondary_muscles.includes(muscleId)) {
                    this.formData.secondary_muscles.push(muscleId);
                    console.log('✅ Added to secondary muscles:', this.formData.secondary_muscles);
                } else {
                    console.log('⚠️ Muscle already in secondary list');
                }
            }
            
            // Reset the select
            event.target.value = '';
            console.log('🔥 Reset dropdown value');
        },
        
        removeMuscle(muscleId, type) {
            if (type === 'primary') {
                this.formData.primary_muscles = this.formData.primary_muscles.filter(id => id !== muscleId);
            } else {
                this.formData.secondary_muscles = this.formData.secondary_muscles.filter(id => id !== muscleId);
            }
        },
        
        getMusclesByBodyPart(bodyPart) {
            return this.muscles.filter(muscle => muscle.body_part === bodyPart);
        },
        
        getAvailableMuscles(bodyPart) {
            return this.muscles.filter(muscle => 
                muscle.body_part === bodyPart && 
                !this.formData.primary_muscles.includes(muscle.id) && 
                !this.formData.secondary_muscles.includes(muscle.id)
            );
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
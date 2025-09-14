/**
 * AI-Backed Patient Symptom Analysis Service
 *
 * This service provides AI-powered symptom analysis using patient data,
 * adaptive questioning, and disorder prediction capabilities.
 *
 * Features:
 * - Patient data integration
 * - Adaptive questioning algorithms
 * - AI-powered disorder prediction
 * - Progressive narrowing (Top 10 → Top 5 → Top 3 → Final prediction)
 * - Public health data integration
 * - Medical compliance and privacy protection
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class AISymptomAnalysisService {
    constructor(databaseService, medicalValidationService, auditLoggingService, hipaaService) {
        this.db = databaseService;
        this.medicalValidator = medicalValidationService;
        this.auditLogger = auditLoggingService;
        this.hipaaService = hipaaService;

        // Initialize symptom categories and question banks
        this.initializeSymptomDatabase();
        this.initializeQuestionBank();
        this.initializeDisorderDatabase();
    }

    /**
     * Initialize comprehensive symptom database
     */
    initializeSymptomDatabase() {
        this.symptomCategories = {
            'constitutional': ['fever', 'fatigue', 'weight_loss', 'weight_gain', 'night_sweats', 'chills', 'malaise'],
            'cardiovascular': ['chest_pain', 'shortness_of_breath', 'palpitations', 'edema', 'syncope', 'claudication'],
            'respiratory': ['cough', 'dyspnea', 'wheezing', 'hemoptysis', 'chest_tightness', 'sputum_production'],
            'gastrointestinal': ['nausea', 'vomiting', 'diarrhea', 'constipation', 'abdominal_pain', 'heartburn', 'bloating'],
            'neurological': ['headache', 'dizziness', 'seizures', 'weakness', 'numbness', 'memory_loss', 'confusion'],
            'musculoskeletal': ['joint_pain', 'muscle_pain', 'stiffness', 'swelling', 'back_pain', 'neck_pain'],
            'dermatological': ['rash', 'itching', 'skin_changes', 'lesions', 'hair_loss', 'nail_changes'],
            'genitourinary': ['dysuria', 'frequency', 'urgency', 'hematuria', 'incontinence', 'pelvic_pain'],
            'psychiatric': ['anxiety', 'depression', 'mood_changes', 'sleep_disturbances', 'concentration_problems'],
            'endocrine': ['polyuria', 'polydipsia', 'heat_intolerance', 'cold_intolerance', 'menstrual_changes']
        };

        this.symptomSeverityScale = {
            1: 'Mild - Barely noticeable, does not interfere with daily activities',
            2: 'Mild-Moderate - Noticeable but manageable',
            3: 'Moderate - Interferes with some daily activities',
            4: 'Moderate-Severe - Significantly impacts daily life',
            5: 'Severe - Unable to perform normal activities'
        };
    }

    /**
     * Initialize adaptive questioning bank
     */
    initializeQuestionBank() {
        this.questionBank = {
            initial: [
                "What is your primary concern or main symptom?",
                "When did you first notice this symptom?",
                "How would you rate the severity on a scale of 1-5?",
                "Is this symptom constant or does it come and go?",
                "What makes it better or worse?"
            ],
            followUp: {
                pain: [
                    "Can you describe the type of pain (sharp, dull, burning, throbbing)?",
                    "Does the pain radiate to other areas?",
                    "What activities trigger or worsen the pain?",
                    "Have you taken any medications for this pain?"
                ],
                constitutional: [
                    "Have you had any recent infections or illnesses?",
                    "Any recent travel or exposure to sick individuals?",
                    "How is your appetite and energy level?",
                    "Any unintentional weight changes?"
                ],
                respiratory: [
                    "Do you have any known allergies or asthma?",
                    "Any recent exposure to irritants or allergens?",
                    "Does breathing difficulty occur at rest or with activity?",
                    "Any associated chest pain or wheezing?"
                ],
                gastrointestinal: [
                    "Any recent dietary changes or new foods?",
                    "How are your bowel movements?",
                    "Any associated nausea or vomiting?",
                    "Any abdominal pain or cramping?"
                ]
            },
            risk_factors: [
                "Do you have any chronic medical conditions?",
                "What medications are you currently taking?",
                "Do you have any known allergies?",
                "Any family history of similar symptoms or conditions?",
                "Do you smoke, drink alcohol, or use recreational drugs?",
                "What is your occupation and any workplace exposures?"
            ]
        };
    }

    /**
     * Initialize disorder prediction database
     */
    initializeDisorderDatabase() {
        this.disorderPatterns = {
            'DZ_CAR_001': {
                name: 'Myocardial Infarction',
                icd10: 'I21.9',
                symptoms: ['chest_pain', 'shortness_of_breath', 'nausea', 'diaphoresis', 'arm_pain'],
                risk_factors: ['hypertension', 'diabetes', 'smoking', 'family_history', 'hyperlipidemia'],
                urgency: 'emergency',
                confidence_threshold: 0.7
            },
            'DZ_NEU_001': {
                name: 'Alzheimer Disease',
                icd10: 'G30.9',
                symptoms: ['memory_loss', 'confusion', 'disorientation', 'personality_changes', 'language_problems'],
                risk_factors: ['age_over_65', 'family_history', 'apoe4_gene', 'head_trauma', 'cardiovascular_disease'],
                urgency: 'routine',
                confidence_threshold: 0.6
            },
            'DZ_GEN_001': {
                name: 'Polycystic Kidney Disease',
                icd10: 'Q61.2',
                symptoms: ['flank_pain', 'hematuria', 'hypertension', 'abdominal_mass', 'kidney_stones'],
                risk_factors: ['family_history', 'genetic_mutation'],
                urgency: 'urgent',
                confidence_threshold: 0.8
            },
            'DZ_NEU_004': {
                name: 'Trigeminal Neuralgia',
                icd10: 'G50.0',
                symptoms: ['facial_pain', 'electric_shock_pain', 'trigger_points', 'unilateral_pain'],
                risk_factors: ['multiple_sclerosis', 'age_over_50', 'hypertension'],
                urgency: 'urgent',
                confidence_threshold: 0.75
            },
            'DZ_GEN_003': {
                name: 'Systemic Lupus Erythematosus',
                icd10: 'M32.9',
                symptoms: ['joint_pain', 'fatigue', 'rash', 'fever', 'kidney_problems', 'photosensitivity'],
                risk_factors: ['female_gender', 'age_15_45', 'family_history', 'certain_medications'],
                urgency: 'urgent',
                confidence_threshold: 0.7
            }
        };
    }

    /**
     * Start a new symptom analysis session
     */
    async startSymptomAnalysis(userId, sessionData = {}) {
        try {
            // Create new analysis session
            const sessionId = uuidv4();
            const timestamp = new Date().toISOString();

            // Get patient data for context
            const patientData = await this.getPatientContext(userId);

            // Initialize session
            const session = {
                session_id: sessionId,
                user_id: userId,
                status: 'active',
                current_phase: 'initial_screening',
                patient_context: patientData,
                symptoms: [],
                responses: [],
                disorder_candidates: [],
                confidence_scores: {},
                created_at: timestamp,
                updated_at: timestamp,
                ...sessionData
            };

            // Store session in database
            await this.storeAnalysisSession(session);

            // Log session start
            await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_STARTED', {
                user_id: userId,
                session_id: sessionId,
                patient_context_loaded: !!patientData
            });

            return {
                success: true,
                session_id: sessionId,
                initial_questions: this.getInitialQuestions(patientData),
                patient_context: patientData
            };

        } catch (error) {
            await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_ERROR', {
                user_id: userId,
                error: error.message,
                operation: 'start_analysis'
            });
            throw error;
        }
    }

    /**
     * Get patient context from existing data
     */
    async getPatientContext(userId) {
        try {
            // Get user profile
            const user = await this.db.getUserById(userId);
            if (!user) return null;

            // Get family disease history
            const familyDiseases = await this.db.getUserFamilyDiseases(userId);

            // Get user's own medical history if available
            const medicalHistory = await this.db.getUserMedicalHistory(userId);

            // Build context
            const context = {
                age: user.age || null,
                gender: user.gender || null,
                family_diseases: familyDiseases.map(fd => ({
                    disease_id: fd.disease_id,
                    disease_name: fd.disease_name,
                    family_member: fd.family_member,
                    inheritance_pattern: fd.inheritance_pattern
                })),
                medical_history: medicalHistory || [],
                risk_factors: this.calculateRiskFactors(user, familyDiseases)
            };

            return context;

        } catch (error) {
            console.error('Error getting patient context:', error);
            return null;
        }
    }

    /**
     * Calculate risk factors based on patient data
     */
    calculateRiskFactors(user, familyDiseases) {
        const riskFactors = [];

        // Age-based risk factors
        if (user.age) {
            if (user.age > 65) riskFactors.push('age_over_65');
            if (user.age > 50) riskFactors.push('age_over_50');
            if (user.age >= 15 && user.age <= 45) riskFactors.push('age_15_45');
        }

        // Gender-based risk factors
        if (user.gender === 'female') riskFactors.push('female_gender');
        if (user.gender === 'male') riskFactors.push('male_gender');

        // Family history risk factors
        const familyDiseaseIds = familyDiseases.map(fd => fd.disease_id);
        if (familyDiseaseIds.includes('DZ_GEN_001') || familyDiseaseIds.includes('DZ_GEN_002')) {
            riskFactors.push('family_history_kidney_disease');
        }
        if (familyDiseaseIds.includes('DZ_NEU_001')) {
            riskFactors.push('family_history_alzheimers');
        }
        if (familyDiseaseIds.includes('DZ_GEN_003')) {
            riskFactors.push('family_history_autoimmune');
        }

        return riskFactors;
    }

    /**
     * Get initial screening questions
     */
    getInitialQuestions(patientContext) {
        const questions = [...this.questionBank.initial];

        // Add context-specific questions
        if (patientContext && patientContext.family_diseases.length > 0) {
            questions.push("Are you experiencing any symptoms similar to family members with known conditions?");
        }

        if (patientContext && patientContext.age && patientContext.age > 65) {
            questions.push("Have you noticed any changes in your memory or thinking?");
        }

        return questions.map((question, index) => ({
            id: index + 1,
            question: question,
            type: 'text',
            required: index < 3 // First 3 questions are required
        }));
    }

    /**
     * Process patient responses and generate follow-up questions
     */
    async processResponses(sessionId, responses) {
        try {
            // Get session
            const session = await this.getAnalysisSession(sessionId);
            if (!session) {
                throw new Error('Analysis session not found');
            }

            // Update session with responses
            session.responses.push(...responses);
            session.updated_at = new Date().toISOString();

            // Analyze responses and extract symptoms
            const extractedSymptoms = await this.extractSymptomsFromResponses(responses);
            session.symptoms.push(...extractedSymptoms);

            // Generate disorder candidates
            const disorderCandidates = await this.generateDisorderCandidates(session);
            session.disorder_candidates = disorderCandidates;

            // Determine next phase and questions
            const nextPhase = this.determineNextPhase(session);
            const followUpQuestions = await this.generateFollowUpQuestions(session, nextPhase);

            // Update session
            session.current_phase = nextPhase;
            await this.updateAnalysisSession(session);

            // Log progress
            await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_PROGRESS', {
                user_id: session.user_id,
                session_id: sessionId,
                phase: nextPhase,
                symptoms_count: session.symptoms.length,
                candidates_count: disorderCandidates.length
            });

            return {
                success: true,
                session_id: sessionId,
                current_phase: nextPhase,
                symptoms: session.symptoms,
                follow_up_questions: followUpQuestions,
                disorder_candidates: this.filterCandidatesByPhase(disorderCandidates, nextPhase)
            };

        } catch (error) {
            await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_ERROR', {
                session_id: sessionId,
                error: error.message,
                operation: 'process_responses'
            });
            throw error;
        }
    }

    /**
     * Extract symptoms from patient responses using NLP and pattern matching
     */
    async extractSymptomsFromResponses(responses) {
        const symptoms = [];

        for (const response of responses) {
            const text = response.answer.toLowerCase();

            // Check each symptom category
            for (const [category, symptomList] of Object.entries(this.symptomCategories)) {
                for (const symptom of symptomList) {
                    // Simple keyword matching (in production, would use more sophisticated NLP)
                    const synonyms = this.getSymptomSynonyms(symptom);

                    for (const synonym of synonyms) {
                        if (text.includes(synonym)) {
                            symptoms.push({
                                symptom: symptom,
                                category: category,
                                severity: this.extractSeverity(text),
                                duration: this.extractDuration(text),
                                context: response.question,
                                confidence: 0.8 // Would be calculated by NLP model
                            });
                            break;
                        }
                    }
                }
            }
        }

        return symptoms;
    }

    /**
     * Get symptom synonyms for better matching
     */
    getSymptomSynonyms(symptom) {
        const synonymMap = {
            'chest_pain': ['chest pain', 'chest ache', 'chest discomfort', 'heart pain'],
            'shortness_of_breath': ['shortness of breath', 'difficulty breathing', 'breathless', 'dyspnea'],
            'headache': ['headache', 'head pain', 'migraine', 'head ache'],
            'fatigue': ['fatigue', 'tired', 'exhausted', 'weak', 'low energy'],
            'fever': ['fever', 'temperature', 'hot', 'feverish'],
            'joint_pain': ['joint pain', 'arthritis', 'stiff joints', 'sore joints'],
            'memory_loss': ['memory loss', 'forgetful', 'memory problems', 'cant remember']
        };

        return synonymMap[symptom] || [symptom.replace('_', ' ')];
    }

    /**
     * Extract severity from response text
     */
    extractSeverity(text) {
        const severityKeywords = {
            5: ['severe', 'unbearable', 'excruciating', 'worst ever'],
            4: ['bad', 'intense', 'significant'],
            3: ['moderate', 'noticeable', 'affecting'],
            2: ['mild', 'slight', 'minor'],
            1: ['barely', 'hardly', 'minimal']
        };

        for (const [severity, keywords] of Object.entries(severityKeywords)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    return parseInt(severity);
                }
            }
        }

        return 3; // Default to moderate
    }

    /**
     * Extract duration from response text
     */
    extractDuration(text) {
        const durationPatterns = [
            { pattern: /(\d+)\s*(day|days)/, unit: 'days' },
            { pattern: /(\d+)\s*(week|weeks)/, unit: 'weeks' },
            { pattern: /(\d+)\s*(month|months)/, unit: 'months' },
            { pattern: /(\d+)\s*(year|years)/, unit: 'years' }
        ];

        for (const { pattern, unit } of durationPatterns) {
            const match = text.match(pattern);
            if (match) {
                return `${match[1]} ${unit}`;
            }
        }

        return 'unknown';
    }

    /**
     * Generate disorder candidates using AI pattern matching
     */
    async generateDisorderCandidates(session) {
        const candidates = [];

        for (const [disorderId, disorder] of Object.entries(this.disorderPatterns)) {
            const confidence = await this.calculateDisorderConfidence(session, disorder);

            if (confidence > 0.1) { // Only include if there's some match
                candidates.push({
                    disorder_id: disorderId,
                    disorder_name: disorder.name,
                    icd10_code: disorder.icd10,
                    confidence: confidence,
                    matching_symptoms: this.getMatchingSymptoms(session.symptoms, disorder.symptoms),
                    matching_risk_factors: this.getMatchingRiskFactors(session.patient_context, disorder.risk_factors),
                    urgency: disorder.urgency,
                    recommendation: this.generateRecommendation(confidence, disorder.urgency)
                });
            }
        }

        // Sort by confidence score
        return candidates.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Calculate confidence score for a disorder
     */
    async calculateDisorderConfidence(session, disorder) {
        let confidence = 0;
        let maxPossibleScore = 0;

        // Symptom matching (60% of score)
        const symptomWeight = 0.6;
        const matchingSymptoms = this.getMatchingSymptoms(session.symptoms, disorder.symptoms);
        const symptomScore = matchingSymptoms.length / disorder.symptoms.length;
        confidence += symptomScore * symptomWeight;
        maxPossibleScore += symptomWeight;

        // Risk factor matching (30% of score)
        const riskFactorWeight = 0.3;
        if (session.patient_context && session.patient_context.risk_factors) {
            const matchingRiskFactors = this.getMatchingRiskFactors(session.patient_context, disorder.risk_factors);
            const riskFactorScore = matchingRiskFactors.length / Math.max(disorder.risk_factors.length, 1);
            confidence += riskFactorScore * riskFactorWeight;
        }
        maxPossibleScore += riskFactorWeight;

        // Family history bonus (10% of score)
        const familyHistoryWeight = 0.1;
        if (this.hasFamilyHistory(session.patient_context, disorder)) {
            confidence += familyHistoryWeight;
        }
        maxPossibleScore += familyHistoryWeight;

        // Normalize confidence
        return Math.min(confidence / maxPossibleScore, 1.0);
    }

    /**
     * Get matching symptoms between patient and disorder
     */
    getMatchingSymptoms(patientSymptoms, disorderSymptoms) {
        const patientSymptomNames = patientSymptoms.map(s => s.symptom);
        return disorderSymptoms.filter(ds => patientSymptomNames.includes(ds));
    }

    /**
     * Get matching risk factors
     */
    getMatchingRiskFactors(patientContext, disorderRiskFactors) {
        if (!patientContext || !patientContext.risk_factors) return [];
        return disorderRiskFactors.filter(rf => patientContext.risk_factors.includes(rf));
    }

    /**
     * Check if patient has family history relevant to disorder
     */
    hasFamilyHistory(patientContext, disorder) {
        if (!patientContext || !patientContext.family_diseases) return false;

        const familyDiseaseNames = patientContext.family_diseases.map(fd => fd.disease_name.toLowerCase());
        const disorderName = disorder.name.toLowerCase();

        return familyDiseaseNames.some(name =>
            name.includes(disorderName) || disorderName.includes(name)
        );
    }

    /**
     * Generate recommendation based on confidence and urgency
     */
    generateRecommendation(confidence, urgency) {
        if (urgency === 'emergency' && confidence > 0.7) {
            return 'Seek immediate emergency medical attention';
        } else if (urgency === 'urgent' && confidence > 0.6) {
            return 'Schedule urgent appointment with healthcare provider';
        } else if (confidence > 0.5) {
            return 'Discuss with healthcare provider at next routine visit';
        } else {
            return 'Monitor symptoms and consult healthcare provider if worsening';
        }
    }

    /**
     * Determine next phase of analysis
     */
    determineNextPhase(session) {
        const candidateCount = session.disorder_candidates.length;
        const responseCount = session.responses.length;

        if (responseCount < 5) {
            return 'initial_screening';
        } else if (candidateCount > 10) {
            return 'narrowing_to_10';
        } else if (candidateCount > 5) {
            return 'narrowing_to_5';
        } else if (candidateCount > 3) {
            return 'narrowing_to_3';
        } else {
            return 'final_assessment';
        }
    }

    /**
     * Generate adaptive follow-up questions
     */
    async generateFollowUpQuestions(session, phase) {
        const questions = [];

        // Get top candidates for targeted questions
        const topCandidates = session.disorder_candidates.slice(0, 5);

        // Generate questions based on phase
        switch (phase) {
            case 'narrowing_to_10':
                questions.push(...this.generateNarrowingQuestions(topCandidates, 'broad'));
                break;
            case 'narrowing_to_5':
                questions.push(...this.generateNarrowingQuestions(topCandidates, 'specific'));
                break;
            case 'narrowing_to_3':
                questions.push(...this.generateDifferentialQuestions(topCandidates));
                break;
            case 'final_assessment':
                questions.push(...this.generateConfirmationQuestions(topCandidates));
                break;
            default:
                questions.push(...this.questionBank.risk_factors);
        }

        return questions.map((question, index) => ({
            id: index + 1,
            question: question,
            type: 'text',
            required: true
        }));
    }

    /**
     * Generate narrowing questions based on top candidates
     */
    generateNarrowingQuestions(candidates, specificity) {
        const questions = [];
        const askedAbout = new Set();

        for (const candidate of candidates.slice(0, 3)) {
            const disorder = this.disorderPatterns[candidate.disorder_id];

            // Ask about unmentioned symptoms
            for (const symptom of disorder.symptoms) {
                if (!askedAbout.has(symptom)) {
                    const synonyms = this.getSymptomSynonyms(symptom);
                    questions.push(`Have you experienced any ${synonyms[0]}?`);
                    askedAbout.add(symptom);

                    if (questions.length >= 5) break;
                }
            }

            if (questions.length >= 5) break;
        }

        return questions;
    }

    /**
     * Generate differential diagnosis questions
     */
    generateDifferentialQuestions(candidates) {
        const questions = [];

        // Ask specific questions to differentiate between top candidates
        if (candidates.length >= 2) {
            const disorder1 = this.disorderPatterns[candidates[0].disorder_id];
            const disorder2 = this.disorderPatterns[candidates[1].disorder_id];

            // Find unique symptoms between top 2 candidates
            const unique1 = disorder1.symptoms.filter(s => !disorder2.symptoms.includes(s));
            const unique2 = disorder2.symptoms.filter(s => !disorder1.symptoms.includes(s));

            if (unique1.length > 0) {
                const synonyms = this.getSymptomSynonyms(unique1[0]);
                questions.push(`Have you noticed any ${synonyms[0]}?`);
            }

            if (unique2.length > 0) {
                const synonyms = this.getSymptomSynonyms(unique2[0]);
                questions.push(`Have you experienced ${synonyms[0]}?`);
            }
        }

        questions.push("On a scale of 1-10, how much is this affecting your daily life?");
        questions.push("Have any family members been diagnosed with similar symptoms?");

        return questions;
    }

    /**
     * Generate confirmation questions for final assessment
     */
    generateConfirmationQuestions(candidates) {
        const questions = [
            "How long have you been experiencing these symptoms overall?",
            "Have the symptoms been getting better, worse, or staying the same?",
            "Is there anything specific that triggers these symptoms?",
            "Have you taken any medications or treatments for these symptoms?",
            "Are there any other symptoms or concerns you haven't mentioned?"
        ];

        return questions;
    }

    /**
     * Filter candidates by analysis phase
     */
    filterCandidatesByPhase(candidates, phase) {
        switch (phase) {
            case 'narrowing_to_10':
                return {
                    top_10: candidates.slice(0, 10),
                    total_candidates: candidates.length
                };
            case 'narrowing_to_5':
                return {
                    top_10: candidates.slice(0, 10),
                    top_5: candidates.slice(0, 5),
                    total_candidates: candidates.length
                };
            case 'narrowing_to_3':
                return {
                    top_10: candidates.slice(0, 10),
                    top_5: candidates.slice(0, 5),
                    top_3: candidates.slice(0, 3),
                    total_candidates: candidates.length
                };
            case 'final_assessment':
                return {
                    top_10: candidates.slice(0, 10),
                    top_5: candidates.slice(0, 5),
                    top_3: candidates.slice(0, 3),
                    final_prediction: candidates[0] || null,
                    total_candidates: candidates.length
                };
            default:
                return {
                    candidates: candidates,
                    total_candidates: candidates.length
                };
        }
    }

    /**
     * Complete symptom analysis and generate final report
     */
    async completeAnalysis(sessionId) {
        try {
            const session = await this.getAnalysisSession(sessionId);
            if (!session) {
                throw new Error('Analysis session not found');
            }

            // Generate final analysis report
            const finalReport = await this.generateFinalReport(session);

            // Update session status
            session.status = 'completed';
            session.final_report = finalReport;
            session.completed_at = new Date().toISOString();
            await this.updateAnalysisSession(session);

            // Log completion
            await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_COMPLETED', {
                user_id: session.user_id,
                session_id: sessionId,
                final_prediction: finalReport.final_prediction?.disorder_name,
                confidence: finalReport.final_prediction?.confidence
            });

            return finalReport;

        } catch (error) {
            await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_ERROR', {
                session_id: sessionId,
                error: error.message,
                operation: 'complete_analysis'
            });
            throw error;
        }
    }

    /**
     * Generate comprehensive final analysis report
     */
    async generateFinalReport(session) {
        const candidates = session.disorder_candidates;

        const report = {
            session_id: session.session_id,
            user_id: session.user_id,
            analysis_date: new Date().toISOString(),
            symptoms_analyzed: session.symptoms,
            patient_context: session.patient_context,

            // The 4 required lists
            top_10_disorders: candidates.slice(0, 10),
            top_5_disorders: candidates.slice(0, 5),
            top_3_disorders: candidates.slice(0, 3),
            final_prediction: candidates[0] || null,

            // Additional analysis
            confidence_summary: {
                highest_confidence: candidates[0]?.confidence || 0,
                average_confidence: this.calculateAverageConfidence(candidates.slice(0, 10)),
                confidence_distribution: this.getConfidenceDistribution(candidates)
            },

            recommendations: this.generateFinalRecommendations(candidates),
            next_steps: this.generateNextSteps(candidates),

            // Disclaimers
            medical_disclaimer: "This analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a healthcare provider for proper medical evaluation.",

            // Quality metrics
            analysis_quality: {
                symptoms_count: session.symptoms.length,
                responses_count: session.responses.length,
                context_completeness: this.assessContextCompleteness(session.patient_context),
                analysis_thoroughness: this.assessAnalysisThoroughness(session)
            }
        };

        return report;
    }

    /**
     * Calculate average confidence score
     */
    calculateAverageConfidence(candidates) {
        if (candidates.length === 0) return 0;
        const sum = candidates.reduce((acc, candidate) => acc + candidate.confidence, 0);
        return sum / candidates.length;
    }

    /**
     * Get confidence distribution
     */
    getConfidenceDistribution(candidates) {
        const distribution = {
            high: 0,    // > 0.7
            medium: 0,  // 0.4 - 0.7
            low: 0      // < 0.4
        };

        for (const candidate of candidates) {
            if (candidate.confidence > 0.7) {
                distribution.high++;
            } else if (candidate.confidence >= 0.4) {
                distribution.medium++;
            } else {
                distribution.low++;
            }
        }

        return distribution;
    }

    /**
     * Generate final recommendations
     */
    generateFinalRecommendations(candidates) {
        const recommendations = [];

        if (candidates.length === 0) {
            recommendations.push("No specific disorders identified based on current symptoms. Continue monitoring and consult healthcare provider if symptoms persist or worsen.");
            return recommendations;
        }

        const topCandidate = candidates[0];

        // Primary recommendation based on top candidate
        recommendations.push(topCandidate.recommendation);

        // Additional recommendations based on urgency
        const emergencyConditions = candidates.filter(c => c.urgency === 'emergency' && c.confidence > 0.5);
        if (emergencyConditions.length > 0) {
            recommendations.unshift("⚠️ URGENT: Based on symptoms, seek immediate medical attention to rule out serious conditions.");
        }

        const urgentConditions = candidates.filter(c => c.urgency === 'urgent' && c.confidence > 0.4);
        if (urgentConditions.length > 0) {
            recommendations.push("Schedule an appointment with your healthcare provider within the next few days.");
        }

        // Lifestyle recommendations
        recommendations.push("Keep a symptom diary noting triggers, severity, and timing.");
        recommendations.push("Stay hydrated and get adequate rest.");

        return recommendations;
    }

    /**
     * Generate next steps
     */
    generateNextSteps(candidates) {
        const steps = [];

        if (candidates.length > 0) {
            const topCandidate = candidates[0];

            steps.push(`Discuss possibility of ${topCandidate.disorder_name} with your healthcare provider`);
            steps.push("Bring this analysis report to your medical appointment");

            if (topCandidate.confidence > 0.6) {
                steps.push("Request appropriate diagnostic tests or referrals");
            }
        }

        steps.push("Continue monitoring symptoms and note any changes");
        steps.push("Follow up if symptoms worsen or new symptoms develop");

        return steps;
    }

    /**
     * Assess context completeness
     */
    assessContextCompleteness(context) {
        if (!context) return 0;

        let completeness = 0;
        const factors = ['age', 'gender', 'family_diseases', 'medical_history', 'risk_factors'];

        for (const factor of factors) {
            if (context[factor] &&
                (Array.isArray(context[factor]) ? context[factor].length > 0 : context[factor])) {
                completeness += 0.2;
            }
        }

        return completeness;
    }

    /**
     * Assess analysis thoroughness
     */
    assessAnalysisThoroughness(session) {
        let score = 0;

        // Response count (max 0.3)
        score += Math.min(session.responses.length / 10, 0.3);

        // Symptom diversity (max 0.3)
        const uniqueCategories = new Set(session.symptoms.map(s => s.category));
        score += Math.min(uniqueCategories.size / 5, 0.3);

        // Analysis phases completed (max 0.4)
        const phases = ['initial_screening', 'narrowing_to_10', 'narrowing_to_5', 'narrowing_to_3', 'final_assessment'];
        const currentPhaseIndex = phases.indexOf(session.current_phase);
        score += (currentPhaseIndex + 1) / phases.length * 0.4;

        return score;
    }

    /**
     * Database operations for analysis sessions
     */
    async storeAnalysisSession(session) {
        const query = `
            INSERT INTO symptom_analysis_sessions (
                session_id, user_id, status, current_phase, patient_context,
                symptoms, responses, disorder_candidates, confidence_scores,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            session.session_id,
            session.user_id,
            session.status,
            session.current_phase,
            JSON.stringify(session.patient_context),
            JSON.stringify(session.symptoms),
            JSON.stringify(session.responses),
            JSON.stringify(session.disorder_candidates),
            JSON.stringify(session.confidence_scores),
            session.created_at,
            session.updated_at
        ];

        return this.db.run(query, params);
    }

    async getAnalysisSession(sessionId) {
        const query = `SELECT * FROM symptom_analysis_sessions WHERE session_id = ?`;
        const row = await this.db.get(query, [sessionId]);

        if (row) {
            // Parse JSON fields
            row.patient_context = JSON.parse(row.patient_context || '{}');
            row.symptoms = JSON.parse(row.symptoms || '[]');
            row.responses = JSON.parse(row.responses || '[]');
            row.disorder_candidates = JSON.parse(row.disorder_candidates || '[]');
            row.confidence_scores = JSON.parse(row.confidence_scores || '{}');
            if (row.final_report) {
                row.final_report = JSON.parse(row.final_report);
            }
        }

        return row;
    }

    async updateAnalysisSession(session) {
        const query = `
            UPDATE symptom_analysis_sessions SET
                status = ?, current_phase = ?, patient_context = ?,
                symptoms = ?, responses = ?, disorder_candidates = ?,
                confidence_scores = ?, updated_at = ?, final_report = ?,
                completed_at = ?
            WHERE session_id = ?
        `;

        const params = [
            session.status,
            session.current_phase,
            JSON.stringify(session.patient_context),
            JSON.stringify(session.symptoms),
            JSON.stringify(session.responses),
            JSON.stringify(session.disorder_candidates),
            JSON.stringify(session.confidence_scores),
            session.updated_at,
            session.final_report ? JSON.stringify(session.final_report) : null,
            session.completed_at || null,
            session.session_id
        ];

        return this.db.run(query, params);
    }

    /**
     * Get user's analysis history
     */
    async getUserAnalysisHistory(userId, limit = 10) {
        const query = `
            SELECT session_id, status, current_phase, created_at, completed_at,
                   JSON_EXTRACT(final_report, '$.final_prediction.disorder_name') as predicted_disorder,
                   JSON_EXTRACT(final_report, '$.final_prediction.confidence') as confidence
            FROM symptom_analysis_sessions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `;

        return this.db.all(query, [userId, limit]);
    }

    /**
     * Delete analysis session (with proper audit logging)
     */
    async deleteAnalysisSession(sessionId, userId) {
        // Verify ownership
        const session = await this.getAnalysisSession(sessionId);
        if (!session || session.user_id !== userId) {
            throw new Error('Session not found or access denied');
        }

        // Log deletion
        await this.auditLogger.logEvent('SYMPTOM_ANALYSIS_DELETED', {
            user_id: userId,
            session_id: sessionId,
            deleted_at: new Date().toISOString()
        });

        // Delete session
        const query = `DELETE FROM symptom_analysis_sessions WHERE session_id = ?`;
        return this.db.run(query, [sessionId]);
    }
}

module.exports = AISymptomAnalysisService;
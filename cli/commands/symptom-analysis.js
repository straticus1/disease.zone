/**
 * CLI commands for AI-powered symptom analysis
 *
 * Provides comprehensive command-line interface for:
 * - Starting symptom analysis sessions
 * - Interactive questioning and response collection
 * - Viewing analysis results and history
 * - Managing analysis sessions
 */

const axios = require('axios');
const chalk = require('chalk');
const { prompt } = require('enquirer');
const fs = require('fs').promises;
const path = require('path');

class SymptomAnalysisCLI {
    constructor(config) {
        this.config = config;
        this.baseURL = config.baseURL;
        this.authToken = config.authToken;
        this.outputFormat = config.outputFormat || 'table';
    }

    /**
     * Start a new symptom analysis session
     */
    async startAnalysis(options = {}) {
        try {
            console.log(chalk.blue.bold('\n🧠 Starting AI Symptom Analysis Session\n'));

            // Display medical disclaimer
            this.displayMedicalDisclaimer();

            // Confirm user wants to proceed
            const { proceed } = await prompt({
                type: 'confirm',
                name: 'proceed',
                message: 'Do you want to start the symptom analysis?',
                initial: true
            });

            if (!proceed) {
                console.log(chalk.yellow('Analysis cancelled.'));
                return;
            }

            // Start analysis session
            const response = await this.makeRequest('POST', '/api/user/symptom-analysis/start', {});

            if (response.success) {
                const sessionData = response.data;
                console.log(chalk.green(`✓ Analysis session started: ${sessionData.session_id}`));

                // Begin interactive questioning
                await this.conductInteractiveAnalysis(sessionData);
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(chalk.red('Error starting analysis:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Conduct interactive analysis with adaptive questioning
     */
    async conductInteractiveAnalysis(sessionData) {
        let sessionId = sessionData.session_id;
        let currentQuestions = sessionData.initial_questions;
        let phase = 'initial_screening';

        console.log(chalk.blue('\n📋 Patient Context Loaded:'));
        if (sessionData.patient_context) {
            const context = sessionData.patient_context;
            if (context.age) console.log(`   Age: ${context.age}`);
            if (context.gender) console.log(`   Gender: ${context.gender}`);
            if (context.family_diseases && context.family_diseases.length > 0) {
                console.log(`   Family Disease History: ${context.family_diseases.length} conditions tracked`);
            }
        }

        while (currentQuestions && currentQuestions.length > 0) {
            console.log(chalk.cyan(`\n📊 Current Phase: ${this.formatPhase(phase)}\n`));

            // Collect responses to current questions
            const responses = await this.collectResponses(currentQuestions);

            if (responses.length === 0) {
                console.log(chalk.yellow('No responses provided. Ending analysis.'));
                break;
            }

            // Submit responses and get next questions
            const result = await this.submitResponses(sessionId, responses);

            if (result.success) {
                const data = result.data;

                // Display current analysis progress
                this.displayProgress(data);

                // Check if we have candidates to show
                if (data.disorder_candidates) {
                    this.displayCurrentCandidates(data.disorder_candidates, data.current_phase);
                }

                // Update for next iteration
                phase = data.current_phase;
                currentQuestions = data.follow_up_questions;

                // If no more questions, complete analysis
                if (!currentQuestions || currentQuestions.length === 0) {
                    await this.completeAnalysis(sessionId);
                    break;
                }
            } else {
                throw new Error(result.error);
            }
        }
    }

    /**
     * Collect responses to questions interactively
     */
    async collectResponses(questions) {
        const responses = [];

        console.log(chalk.blue.bold('Please answer the following questions:\n'));

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];

            console.log(chalk.white.bold(`${i + 1}. ${question.question}`));
            if (question.required) {
                console.log(chalk.red('   * Required'));
            }

            const { answer } = await prompt({
                type: 'input',
                name: 'answer',
                message: 'Your response:',
                validate: question.required ? (input) => input.trim() ? true : 'This question is required' : undefined
            });

            if (answer.trim()) {
                responses.push({
                    question_id: question.id,
                    question: question.question,
                    answer: answer.trim()
                });
            }

            console.log(); // Add spacing
        }

        return responses;
    }

    /**
     * Submit responses to the server
     */
    async submitResponses(sessionId, responses) {
        console.log(chalk.blue('🔄 Processing your responses...'));

        const response = await this.makeRequest('POST', `/api/user/symptom-analysis/${sessionId}/responses`, {
            responses
        });

        return response;
    }

    /**
     * Complete the analysis and show final results
     */
    async completeAnalysis(sessionId) {
        try {
            console.log(chalk.blue('🎯 Completing analysis and generating final report...'));

            const response = await this.makeRequest('POST', `/api/user/symptom-analysis/${sessionId}/complete`);

            if (response.success) {
                this.displayFinalResults(response.data);
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(chalk.red('Error completing analysis:'), error.message);
        }
    }

    /**
     * Display analysis progress
     */
    displayProgress(data) {
        console.log(chalk.green('\n📈 Analysis Progress:'));
        console.log(`   Symptoms Identified: ${data.symptoms?.length || 0}`);
        console.log(`   Disorder Candidates: ${data.disorder_candidates?.total_candidates || 0}`);
    }

    /**
     * Display current top candidates
     */
    displayCurrentCandidates(candidates, phase) {
        if (phase === 'final_assessment' && candidates.top_3) {
            console.log(chalk.yellow('\n🎯 Top 3 Most Likely Disorders:'));
            this.displayDisorderList(candidates.top_3, 3);
        } else if (candidates.top_5 && phase.includes('5')) {
            console.log(chalk.cyan('\n🔍 Top 5 Candidates:'));
            this.displayDisorderList(candidates.top_5, 5);
        } else if (candidates.top_10 && phase.includes('10')) {
            console.log(chalk.blue('\n📊 Top 10 Candidates:'));
            this.displayDisorderList(candidates.top_10, 10);
        }
    }

    /**
     * Display final analysis results
     */
    displayFinalResults(report) {
        console.log(chalk.green.bold('\n🎉 Analysis Complete! Here are your results:\n'));

        // Display the 4 required lists
        if (report.top_10_disorders && report.top_10_disorders.length > 0) {
            console.log(chalk.blue.bold('📊 TOP 10 POSSIBLE DISORDERS:'));
            this.displayDisorderList(report.top_10_disorders, 10);
        }

        if (report.top_5_disorders && report.top_5_disorders.length > 0) {
            console.log(chalk.cyan.bold('\n🔍 TOP 5 REFINED PREDICTIONS:'));
            this.displayDisorderList(report.top_5_disorders, 5);
        }

        if (report.top_3_disorders && report.top_3_disorders.length > 0) {
            console.log(chalk.yellow.bold('\n🎯 TOP 3 MOST LIKELY CONDITIONS:'));
            this.displayDisorderList(report.top_3_disorders, 3);
        }

        if (report.final_prediction) {
            console.log(chalk.green.bold('\n🧠 FINAL AI PREDICTION:'));
            this.displayFinalPrediction(report.final_prediction);
        }

        // Display recommendations
        if (report.recommendations && report.recommendations.length > 0) {
            console.log(chalk.magenta.bold('\n💡 RECOMMENDATIONS:'));
            report.recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }

        // Display next steps
        if (report.next_steps && report.next_steps.length > 0) {
            console.log(chalk.blue.bold('\n📋 NEXT STEPS:'));
            report.next_steps.forEach((step, index) => {
                console.log(`   ${index + 1}. ${step}`);
            });
        }

        // Medical disclaimer
        console.log(chalk.red.bold('\n⚠️  MEDICAL DISCLAIMER:'));
        console.log(chalk.red(report.medical_disclaimer));

        // Quality assessment
        if (report.analysis_quality) {
            console.log(chalk.gray('\n📈 Analysis Quality Metrics:'));
            console.log(`   Symptoms Analyzed: ${report.analysis_quality.symptoms_count}`);
            console.log(`   Questions Answered: ${report.analysis_quality.responses_count}`);
            console.log(`   Context Completeness: ${Math.round(report.analysis_quality.context_completeness * 100)}%`);
            console.log(`   Analysis Thoroughness: ${Math.round(report.analysis_quality.analysis_thoroughness * 100)}%`);
        }

        // Session info
        console.log(chalk.gray(`\n📄 Session ID: ${report.session_id}`));
        console.log(chalk.gray(`📅 Analysis Date: ${new Date(report.analysis_date).toLocaleString()}`));
    }

    /**
     * Display a list of disorders with confidence scores
     */
    displayDisorderList(disorders, maxCount) {
        const count = Math.min(disorders.length, maxCount);

        for (let i = 0; i < count; i++) {
            const disorder = disorders[i];
            const confidence = Math.round(disorder.confidence * 100);
            const confidenceColor = confidence >= 70 ? 'green' : confidence >= 40 ? 'yellow' : 'red';

            console.log(`   ${i + 1}. ${chalk.white.bold(disorder.disorder_name)}`);
            console.log(`      ${chalk[confidenceColor](`Confidence: ${confidence}%`)} | ICD-10: ${disorder.icd10_code}`);
            console.log(`      ${chalk.gray(disorder.recommendation)}`);

            if (disorder.matching_symptoms && disorder.matching_symptoms.length > 0) {
                console.log(`      ${chalk.blue('Matching symptoms:')} ${disorder.matching_symptoms.join(', ')}`);
            }
            console.log();
        }
    }

    /**
     * Display final prediction with detailed information
     */
    displayFinalPrediction(prediction) {
        const confidence = Math.round(prediction.confidence * 100);
        const confidenceColor = confidence >= 70 ? 'green' : confidence >= 40 ? 'yellow' : 'red';

        console.log(`   ${chalk.white.bold(prediction.disorder_name)}`);
        console.log(`   ${chalk[confidenceColor](`Confidence: ${confidence}%`)}`);
        console.log(`   ICD-10 Code: ${prediction.icd10_code}`);

        const urgencyColors = {
            'emergency': 'red',
            'urgent': 'yellow',
            'routine': 'green'
        };
        const urgencyColor = urgencyColors[prediction.urgency] || 'white';

        console.log(`   Urgency: ${chalk[urgencyColor].bold(prediction.urgency.toUpperCase())}`);
        console.log(`   Recommendation: ${chalk.white(prediction.recommendation)}`);

        if (prediction.matching_symptoms && prediction.matching_symptoms.length > 0) {
            console.log(`   Matching Symptoms: ${chalk.blue(prediction.matching_symptoms.join(', '))}`);
        }

        if (prediction.matching_risk_factors && prediction.matching_risk_factors.length > 0) {
            console.log(`   Risk Factors: ${chalk.yellow(prediction.matching_risk_factors.join(', '))}`);
        }
    }

    /**
     * View analysis history
     */
    async viewHistory(options = {}) {
        try {
            console.log(chalk.blue.bold('\n📚 Your Symptom Analysis History\n'));

            const limit = options.limit || 10;
            const response = await this.makeRequest('GET', `/api/user/symptom-analysis/history?limit=${limit}`);

            if (response.success) {
                const history = response.data.history;

                if (history.length === 0) {
                    console.log(chalk.yellow('No previous analyses found.'));
                    return;
                }

                this.displayHistory(history);
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(chalk.red('Error retrieving history:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Display analysis history
     */
    displayHistory(history) {
        history.forEach((session, index) => {
            console.log(`${index + 1}. ${chalk.white.bold(session.predicted_disorder || 'In Progress')}`);
            console.log(`   Session ID: ${session.session_id}`);
            console.log(`   Date: ${new Date(session.created_at).toLocaleString()}`);
            console.log(`   Status: ${this.getStatusBadge(session.status)}`);
            console.log(`   Phase: ${this.formatPhase(session.current_phase)}`);

            if (session.confidence) {
                const confidence = Math.round(session.confidence * 100);
                const confidenceColor = confidence >= 70 ? 'green' : confidence >= 40 ? 'yellow' : 'red';
                console.log(`   Confidence: ${chalk[confidenceColor](`${confidence}%`)}`);
            }

            console.log(); // Add spacing
        });
    }

    /**
     * View specific analysis session
     */
    async viewSession(sessionId, options = {}) {
        try {
            console.log(chalk.blue.bold(`\n📄 Analysis Session: ${sessionId}\n`));

            const response = await this.makeRequest('GET', `/api/user/symptom-analysis/${sessionId}`);

            if (response.success) {
                const session = response.data;
                this.displaySessionDetails(session);
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(chalk.red('Error retrieving session:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Display detailed session information
     */
    displaySessionDetails(session) {
        console.log(`Status: ${this.getStatusBadge(session.status)}`);
        console.log(`Phase: ${this.formatPhase(session.current_phase)}`);
        console.log(`Created: ${new Date(session.created_at).toLocaleString()}`);

        if (session.completed_at) {
            console.log(`Completed: ${new Date(session.completed_at).toLocaleString()}`);
        }

        // Display symptoms
        if (session.symptoms && session.symptoms.length > 0) {
            console.log(chalk.blue('\n🔍 Identified Symptoms:'));
            session.symptoms.forEach(symptom => {
                console.log(`   • ${symptom.symptom} (${symptom.category}) - Severity: ${symptom.severity}/5`);
                if (symptom.duration && symptom.duration !== 'unknown') {
                    console.log(`     Duration: ${symptom.duration}`);
                }
            });
        }

        // Display current candidates
        if (session.disorder_candidates && session.disorder_candidates.length > 0) {
            console.log(chalk.yellow('\n🎯 Current Disorder Candidates:'));
            this.displayDisorderList(session.disorder_candidates.slice(0, 5), 5);
        }

        // Display final report if completed
        if (session.status === 'completed' && session.final_report) {
            this.displayFinalResults(session.final_report);
        }
    }

    /**
     * Delete an analysis session
     */
    async deleteSession(sessionId, options = {}) {
        try {
            if (!options.force) {
                const { confirm } = await prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to delete session ${sessionId}?`,
                    initial: false
                });

                if (!confirm) {
                    console.log(chalk.yellow('Deletion cancelled.'));
                    return;
                }
            }

            const response = await this.makeRequest('DELETE', `/api/user/symptom-analysis/${sessionId}`);

            if (response.success) {
                console.log(chalk.green(`✓ Session ${sessionId} deleted successfully.`));
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(chalk.red('Error deleting session:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Export analysis results to file
     */
    async exportAnalysis(sessionId, outputFile, options = {}) {
        try {
            const response = await this.makeRequest('GET', `/api/user/symptom-analysis/${sessionId}`);

            if (response.success) {
                const session = response.data;

                let exportData;
                if (options.format === 'json') {
                    exportData = JSON.stringify(session, null, 2);
                } else {
                    // Export as formatted text
                    exportData = this.formatSessionForExport(session);
                }

                await fs.writeFile(outputFile, exportData);
                console.log(chalk.green(`✓ Analysis exported to ${outputFile}`));
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(chalk.red('Error exporting analysis:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Format session data for text export
     */
    formatSessionForExport(session) {
        let output = `diseaseZone Symptom Analysis Report\n`;
        output += `=====================================\n\n`;
        output += `Session ID: ${session.session_id}\n`;
        output += `Created: ${new Date(session.created_at).toLocaleString()}\n`;
        output += `Status: ${session.status}\n`;

        if (session.symptoms && session.symptoms.length > 0) {
            output += `\nSymptoms Analyzed:\n`;
            session.symptoms.forEach(symptom => {
                output += `- ${symptom.symptom} (${symptom.category}) - Severity: ${symptom.severity}/5\n`;
            });
        }

        if (session.final_report) {
            const report = session.final_report;

            if (report.final_prediction) {
                output += `\nFinal AI Prediction:\n`;
                output += `${report.final_prediction.disorder_name}\n`;
                output += `Confidence: ${Math.round(report.final_prediction.confidence * 100)}%\n`;
                output += `ICD-10: ${report.final_prediction.icd10_code}\n`;
                output += `Recommendation: ${report.final_prediction.recommendation}\n`;
            }

            if (report.recommendations) {
                output += `\nRecommendations:\n`;
                report.recommendations.forEach((rec, index) => {
                    output += `${index + 1}. ${rec}\n`;
                });
            }
        }

        output += `\nMedical Disclaimer: This analysis is for informational purposes only and is not a substitute for professional medical advice.\n`;

        return output;
    }

    /**
     * Utility methods
     */
    formatPhase(phase) {
        const phaseNames = {
            'initial_screening': 'Initial Screening',
            'narrowing_to_10': 'Narrowing to Top 10',
            'narrowing_to_5': 'Refining to Top 5',
            'narrowing_to_3': 'Focusing on Top 3',
            'final_assessment': 'Final Assessment'
        };
        return phaseNames[phase] || phase;
    }

    getStatusBadge(status) {
        const statusColors = {
            'active': 'yellow',
            'completed': 'green',
            'abandoned': 'red'
        };
        const color = statusColors[status] || 'white';
        return chalk[color](status.toUpperCase());
    }

    displayMedicalDisclaimer() {
        console.log(chalk.red.bold('⚠️  MEDICAL DISCLAIMER'));
        console.log(chalk.red('This AI analysis is for informational purposes only and is NOT a substitute for'));
        console.log(chalk.red('professional medical advice, diagnosis, or treatment. Always seek the advice of'));
        console.log(chalk.red('your physician or other qualified health provider with any questions you may'));
        console.log(chalk.red('have regarding a medical condition.'));
        console.log();
    }

    /**
     * Make authenticated HTTP request
     */
    async makeRequest(method, endpoint, data = null) {
        const config = {
            method,
            url: `${this.baseURL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    }
}

module.exports = SymptomAnalysisCLI;
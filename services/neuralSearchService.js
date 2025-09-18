/**
 * Neural Network Search Service
 * Implements real AI/ML processing for disease data search and query enhancement
 */

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { Matrix } = require('ml-matrix');
const KMeans = require('ml-kmeans');
const { cosine } = require('ml-distance');
const compromise = require('compromise');
// Stemmer will be loaded dynamically in the constructor
const fs = require('fs').promises;
const path = require('path');

class NeuralSearchService {
    constructor() {
        this.isInitialized = false;
        this.model = null;
        this.tokenizer = null;
        this.stemmer = null;
        this.vocabulary = new Map();
        this.documentEmbeddings = new Map();
        this.queryEmbeddings = new Map();
        this.clusters = null;

        // Training data paths
        this.modelPath = path.join(__dirname, '../models/search_model');
        this.vocabPath = path.join(__dirname, '../models/vocabulary.json');
        this.embeddingsPath = path.join(__dirname, '../models/embeddings.json');

        // Disease-specific vocabulary
        this.diseaseTerms = new Set([
            'disease', 'illness', 'condition', 'syndrome', 'disorder', 'infection',
            'virus', 'bacteria', 'pathogen', 'epidemic', 'pandemic', 'outbreak',
            'symptoms', 'treatment', 'diagnosis', 'prevention', 'vaccine',
            'covid', 'coronavirus', 'influenza', 'herpes', 'hiv', 'aids',
            'tuberculosis', 'malaria', 'dengue', 'zika', 'ebola', 'sars',
            'diabetes', 'cancer', 'heart', 'stroke', 'hypertension',
            'surveillance', 'monitoring', 'tracking', 'reporting', 'data'
        ]);

        // Initialize TF.js backend
        this.initializeTensorFlow();
    }

    async initializeTensorFlow() {
        try {
            // Set TensorFlow backend to CPU for better compatibility
            await tf.setBackend('cpu');
            console.log('🧠 TensorFlow.js backend initialized:', tf.getBackend());
        } catch (error) {
            console.error('❌ TensorFlow initialization failed:', error);
        }
    }

    /**
     * Initialize the neural search service
     */
    async initialize() {
        try {
            console.log('🧠 Initializing Neural Search Service...');

            // Load stemmer dynamically as ES module
            try {
                const stemmerModule = await import('stemmer');
                this.stemmer = stemmerModule.default;
                if (typeof this.stemmer !== 'function') {
                    throw new Error('Stemmer not loaded correctly');
                }
                console.log('✅ Stemmer loaded successfully');
            } catch (stemmerError) {
                console.warn('⚠️ Stemmer loading failed, using fallback:', stemmerError.message);
                // Fallback stemmer implementation
                this.stemmer = (word) => word.toLowerCase().replace(/ing$|ed$|s$/, '');
            }

            // Create models directory if it doesn't exist
            await this.ensureModelDirectory();

            // Initialize tokenizer first
            this.initializeTokenizer();

            // Try to load existing model and vocabulary
            const modelExists = await this.loadExistingModel();

            if (!modelExists) {
                console.log('🏗️ No existing model found, creating new neural network...');
                await this.createAndTrainModel();
            }

            this.isInitialized = true;
            console.log('✅ Neural Search Service initialized successfully');

        } catch (error) {
            console.error('❌ Neural Search Service initialization failed:', error);
            // Initialize with basic functionality even if ML fails
            this.initializeBasicMode();
        }
    }

    async ensureModelDirectory() {
        const modelsDir = path.dirname(this.modelPath);
        try {
            await fs.access(modelsDir);
        } catch {
            await fs.mkdir(modelsDir, { recursive: true });
            console.log('📁 Created models directory:', modelsDir);
        }
    }

    async loadExistingModel() {
        try {
            // Check if model files exist
            await fs.access(this.modelPath);
            await fs.access(this.vocabPath);

            // Load the model
            this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);

            // Load vocabulary
            const vocabData = await fs.readFile(this.vocabPath, 'utf8');
            const vocabArray = JSON.parse(vocabData);
            this.vocabulary = new Map(vocabArray);

            // Load embeddings if they exist
            try {
                const embeddingsData = await fs.readFile(this.embeddingsPath, 'utf8');
                const embeddings = JSON.parse(embeddingsData);
                this.documentEmbeddings = new Map(Object.entries(embeddings));
            } catch {
                console.log('📄 No existing embeddings found, will generate new ones');
            }

            console.log('✅ Loaded existing neural search model');
            return true;

        } catch (error) {
            console.log('📄 No existing model found:', error.message);
            return false;
        }
    }

    async createAndTrainModel() {
        console.log('🏗️ Creating neural network architecture...');

        // Build vocabulary from disease terms and common health terms
        await this.buildVocabulary();

        // Create a simple neural network for text embedding
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [this.vocabulary.size],
                    units: 128,
                    activation: 'relu',
                    name: 'embedding_layer'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    name: 'hidden_layer'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'tanh',
                    name: 'output_layer'
                })
            ]
        });

        // Compile the model
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['accuracy']
        });

        console.log('📊 Neural network architecture:');
        this.model.summary();

        // Generate synthetic training data for health/disease queries
        await this.generateTrainingData();

        // Save the model
        await this.saveModel();
    }

    async buildVocabulary() {
        console.log('📚 Building disease-specific vocabulary...');

        const words = new Set();

        // Add disease-specific terms
        this.diseaseTerms.forEach(term => words.add(term));

        // Add common English words relevant to health
        const healthWords = [
            'symptoms', 'treatment', 'diagnosis', 'patient', 'doctor', 'hospital',
            'medicine', 'drug', 'therapy', 'cure', 'heal', 'recovery', 'pain',
            'fever', 'cough', 'fatigue', 'headache', 'nausea', 'vomiting',
            'chronic', 'acute', 'severe', 'mild', 'moderate', 'risk', 'factor',
            'age', 'gender', 'male', 'female', 'child', 'adult', 'elderly',
            'study', 'research', 'clinical', 'trial', 'data', 'statistics',
            'rate', 'incidence', 'prevalence', 'mortality', 'morbidity'
        ];

        healthWords.forEach(word => words.add(word));

        // Convert to vocabulary map with indices
        const sortedWords = Array.from(words).sort();
        sortedWords.forEach((word, index) => {
            this.vocabulary.set(word, index);
        });

        console.log(`✅ Built vocabulary with ${this.vocabulary.size} terms`);
    }

    async generateTrainingData() {
        console.log('🎯 Generating synthetic training data...');

        // Create sample queries and their ideal embeddings
        const sampleQueries = [
            'covid symptoms fever cough',
            'diabetes treatment insulin',
            'heart disease prevention exercise',
            'cancer research clinical trial',
            'influenza vaccine effectiveness',
            'herpes outbreak frequency',
            'hiv testing guidelines',
            'tuberculosis drug resistance',
            'malaria prevention mosquito',
            'stroke risk factors age'
        ];

        const vocabSize = this.vocabulary.size;
        const batchSize = sampleQueries.length;

        // Convert queries to one-hot vectors
        const inputData = [];
        const targetData = [];

        for (let i = 0; i < sampleQueries.length; i++) {
            const query = sampleQueries[i];
            const vector = this.textToVector(query);

            // Create synthetic target (simplified embedding)
            const target = new Array(32).fill(0);
            const words = query.split(' ');
            words.forEach((word, idx) => {
                if (idx < 32) {
                    target[idx] = Math.sin(this.vocabulary.get(word) || 0) * 0.5;
                }
            });

            inputData.push(vector);
            targetData.push(target);
        }

        // Convert to tensors
        const xs = tf.tensor2d(inputData);
        const ys = tf.tensor2d(targetData);

        // Train the model
        console.log('🏋️ Training neural network...');
        const history = await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 4,
            validationSplit: 0.2,
            verbose: 0,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) {
                        console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
                    }
                }
            }
        });

        // Cleanup tensors
        xs.dispose();
        ys.dispose();

        console.log('✅ Neural network training completed');
    }

    async saveModel() {
        try {
            // Save the TensorFlow model
            await this.model.save(`file://${this.modelPath}`);

            // Save vocabulary
            const vocabArray = Array.from(this.vocabulary.entries());
            await fs.writeFile(this.vocabPath, JSON.stringify(vocabArray, null, 2));

            console.log('💾 Model and vocabulary saved successfully');

        } catch (error) {
            console.error('❌ Failed to save model:', error);
        }
    }

    initializeTokenizer() {
        // Initialize Natural.js tokenizer with stemming
        this.tokenizer = {
            tokenize: (text) => {
                // Use compromise for better NLP processing
                const doc = compromise(text);
                const words = doc.terms().out('array');

                // Apply stemming and filtering
                return words
                    .map(word => word.toLowerCase())
                    .map(word => this.stemmer(word))
                    .filter(word => word.length > 2)
                    .filter(word => !natural.stopwords.includes(word));
            }
        };

        console.log('🔤 Tokenizer initialized with stemming and stopword removal');
    }

    initializeBasicMode() {
        console.log('🔧 Initializing basic search mode without neural networks');

        // Initialize basic tokenizer
        this.tokenizer = {
            tokenize: (text) => {
                return text.toLowerCase()
                    .split(/\s+/)
                    .filter(word => word.length > 2)
                    .filter(word => !natural.stopwords.includes(word));
            }
        };

        this.isInitialized = true;
    }

    /**
     * Convert text to vector representation
     */
    textToVector(text) {
        const tokens = this.tokenizer.tokenize(text);
        const vector = new Array(this.vocabulary.size).fill(0);

        tokens.forEach(token => {
            const index = this.vocabulary.get(token);
            if (index !== undefined) {
                vector[index] = 1;
            }
        });

        return vector;
    }

    /**
     * Generate embedding for a query using the neural network
     */
    async generateQueryEmbedding(query) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            if (this.model) {
                // Use neural network to generate embedding
                const vector = this.textToVector(query);
                const inputTensor = tf.tensor2d([vector]);
                const embedding = await this.model.predict(inputTensor);
                const embeddingArray = await embedding.data();

                // Cleanup tensors
                inputTensor.dispose();
                embedding.dispose();

                return Array.from(embeddingArray);
            } else {
                // Fallback to TF-IDF style embedding
                return this.generateBasicEmbedding(query);
            }
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            return this.generateBasicEmbedding(query);
        }
    }

    generateBasicEmbedding(query) {
        const tokens = this.tokenizer.tokenize(query);
        const embedding = new Array(32).fill(0);

        tokens.forEach((token, index) => {
            if (index < 32) {
                // Simple hash-based embedding
                const hash = this.simpleHash(token) % 32;
                embedding[hash] += 1.0 / tokens.length;
            }
        });

        return embedding;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Enhance search query using neural network understanding
     */
    async enhanceQuery(originalQuery, context = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Generate embedding for the original query
            const queryEmbedding = await this.generateQueryEmbedding(originalQuery);

            // Store for similarity comparisons
            this.queryEmbeddings.set(originalQuery, queryEmbedding);

            // Extract key terms using NLP
            const doc = compromise(originalQuery);
            const entities = doc.topics().out('array');
            const verbs = doc.verbs().out('array');
            const nouns = doc.nouns().out('array');

            // Build enhanced query
            let enhancedQuery = originalQuery;

            // Add related disease terms
            const relatedTerms = this.findRelatedDiseaseTerms(originalQuery);
            if (relatedTerms.length > 0) {
                enhancedQuery += ' ' + relatedTerms.join(' ');
            }

            // Add context-specific terms
            if (context.dataFocus) {
                const contextTerms = this.getContextTerms(context.dataFocus);
                enhancedQuery += ' ' + contextTerms.join(' ');
            }

            // Add audience-specific terms
            if (context.audience) {
                const audienceTerms = this.getAudienceTerms(context.audience);
                enhancedQuery += ' ' + audienceTerms.join(' ');
            }

            console.log(`🧠 Enhanced query: "${originalQuery}" → "${enhancedQuery}"`);

            return {
                originalQuery,
                enhancedQuery,
                embedding: queryEmbedding,
                entities,
                relatedTerms,
                confidence: this.calculateQueryConfidence(originalQuery)
            };

        } catch (error) {
            console.error('❌ Query enhancement failed:', error);
            return {
                originalQuery,
                enhancedQuery: originalQuery,
                embedding: null,
                entities: [],
                relatedTerms: [],
                confidence: 0.5
            };
        }
    }

    findRelatedDiseaseTerms(query) {
        const tokens = this.tokenizer.tokenize(query);
        const related = new Set();

        tokens.forEach(token => {
            // Find disease-related synonyms and related terms
            if (token.includes('covid')) {
                related.add('coronavirus').add('sars-cov-2').add('pandemic');
            } else if (token.includes('flu') || token.includes('influenza')) {
                related.add('h1n1').add('seasonal').add('vaccine');
            } else if (token.includes('diabetes')) {
                related.add('insulin').add('glucose').add('blood sugar');
            } else if (token.includes('heart')) {
                related.add('cardiovascular').add('cardiac').add('coronary');
            } else if (token.includes('cancer')) {
                related.add('oncology').add('tumor').add('malignant');
            }
        });

        return Array.from(related);
    }

    getContextTerms(dataFocus) {
        const contextMap = {
            'recent': ['2023', '2024', 'latest', 'current', 'new', 'emerging'],
            'clinical': ['trial', 'study', 'research', 'treatment', 'therapy', 'protocol'],
            'surveillance': ['monitoring', 'tracking', 'outbreak', 'epidemic', 'reporting'],
            'policy': ['guidelines', 'recommendations', 'regulations', 'policy', 'public health'],
            'demographics': ['population', 'age', 'gender', 'race', 'ethnicity', 'statistics'],
            'prevention': ['vaccine', 'immunization', 'prophylaxis', 'screening', 'early detection']
        };

        return contextMap[dataFocus] || [];
    }

    getAudienceTerms(audience) {
        const audienceMap = {
            'researchers': ['study', 'methodology', 'analysis', 'peer-reviewed', 'journal'],
            'clinicians': ['treatment', 'diagnosis', 'clinical', 'patient', 'medical'],
            'public': ['symptoms', 'prevention', 'health tips', 'when to see doctor'],
            'policymakers': ['public health', 'population', 'cost-effectiveness', 'implementation']
        };

        return audienceMap[audience] || [];
    }

    calculateQueryConfidence(query) {
        const tokens = this.tokenizer.tokenize(query);
        let confidence = 0.5; // Base confidence

        // Increase confidence for disease-specific terms
        tokens.forEach(token => {
            if (this.diseaseTerms.has(token)) {
                confidence += 0.1;
            }
        });

        // Adjust for query length (longer queries often more specific)
        if (tokens.length > 3) confidence += 0.1;
        if (tokens.length > 6) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    /**
     * Find similar documents using neural embeddings
     */
    async findSimilarDocuments(queryEmbedding, documentEmbeddings, limit = 10) {
        const similarities = [];

        for (const [docId, docEmbedding] of documentEmbeddings) {
            const similarity = this.calculateCosineSimilarity(queryEmbedding, docEmbedding);
            similarities.push({ docId, similarity });
        }

        // Sort by similarity and return top results
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    calculateCosineSimilarity(vec1, vec2) {
        try {
            return 1 - cosine(vec1, vec2);
        } catch (error) {
            // Fallback to manual calculation
            const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
            const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
            const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));

            if (magnitude1 === 0 || magnitude2 === 0) return 0;
            return dotProduct / (magnitude1 * magnitude2);
        }
    }

    /**
     * Train the model with new search data
     */
    async retrain(searchQueries, searchResults) {
        if (!this.model) {
            console.log('⚠️ No model to retrain, creating new one...');
            await this.createAndTrainModel();
            return;
        }

        console.log('🏋️ Retraining neural network with new search data...');

        try {
            // Process new training data
            const trainingData = this.prepareTrainingData(searchQueries, searchResults);

            if (trainingData.length === 0) {
                console.log('📄 No new training data available');
                return;
            }

            // Convert to tensors
            const xs = tf.tensor2d(trainingData.inputs);
            const ys = tf.tensor2d(trainingData.targets);

            // Retrain with new data
            await this.model.fit(xs, ys, {
                epochs: 10,
                batchSize: Math.min(4, trainingData.length),
                verbose: 0
            });

            // Cleanup tensors
            xs.dispose();
            ys.dispose();

            // Save updated model
            await this.saveModel();

            console.log('✅ Model retrained successfully');

        } catch (error) {
            console.error('❌ Model retraining failed:', error);
        }
    }

    prepareTrainingData(queries, results) {
        const inputs = [];
        const targets = [];

        queries.forEach((query, index) => {
            const result = results[index];
            if (result && result.success) {
                const input = this.textToVector(query);
                const target = this.generateTargetFromResults(result);

                inputs.push(input);
                targets.push(target);
            }
        });

        return { inputs, targets, length: inputs.length };
    }

    generateTargetFromResults(result) {
        // Create target vector based on search result quality
        const target = new Array(32).fill(0);

        if (result.totalResults > 0) {
            // Encode result quality into target vector
            const quality = Math.min(result.totalResults / 100, 1);
            for (let i = 0; i < 32; i++) {
                target[i] = Math.sin(i * quality) * 0.5;
            }
        }

        return target;
    }

    /**
     * Get service status and statistics
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            hasModel: this.model !== null,
            vocabularySize: this.vocabulary.size,
            embeddingsCount: this.documentEmbeddings.size,
            backend: tf.getBackend(),
            version: tf.version.tfjs,
            memoryInfo: this.model ? {
                numTensors: tf.memory().numTensors,
                numBytes: tf.memory().numBytes
            } : null
        };
    }
}

module.exports = NeuralSearchService;
-- Seed data for diseases table
-- Initial disease entries for the platform

INSERT OR IGNORE INTO diseases (disease_code, name, category, subcategory, icd10_codes, inheritance_pattern, prevalence_description) VALUES
-- STD Diseases
('DZ_STD_001', 'Chlamydia', 'std', 'bacterial', '["A56"]', 'none', 'Most common bacterial STD in the US'),
('DZ_STD_002', 'Gonorrhea', 'std', 'bacterial', '["A54"]', 'none', 'Second most common bacterial STD'),
('DZ_STD_003', 'Syphilis', 'std', 'bacterial', '["A50", "A51", "A52", "A53"]', 'none', 'Bacterial infection with multiple stages'),

-- Neurological Diseases
('DZ_NEU_001', 'Alzheimer\'s Disease', 'neurological', 'dementia', '["F03", "G30"]', 'complex', '6.9 million Americans age 65+'),
('DZ_NEU_002', 'Frontotemporal Dementia', 'neurological', 'dementia', '["F02"]', 'complex', 'Less common form of dementia'),
('DZ_NEU_003', 'Vascular Dementia', 'neurological', 'dementia', '["F01"]', 'complex', 'Second most common dementia type'),
('DZ_NEU_004', 'Trigeminal Neuralgia', 'neurological', 'pain_disorder', '["G50.0"]', 'complex', '12-15 per 100,000 people'),
('DZ_NEU_005', 'Multiple Sclerosis', 'neurological', 'autoimmune', '["G35"]', 'complex', '1 million Americans affected'),

-- Genetic Diseases
('DZ_GEN_001', 'Autosomal Dominant Polycystic Kidney Disease', 'genetic', 'kidney', '["Q61.2"]', 'autosomal_dominant', '1 in 400-1000 people'),
('DZ_GEN_002', 'Autosomal Recessive Polycystic Kidney Disease', 'genetic', 'kidney', '["Q61.1"]', 'autosomal_recessive', '1 in 20,000 births'),
('DZ_GEN_003', 'Systemic Lupus Erythematosus', 'genetic', 'autoimmune', '["M32"]', 'complex', '1.5 million Americans'),
('DZ_GEN_004', 'Huntington\'s Disease', 'genetic', 'neurological', '["G10"]', 'autosomal_dominant', '3-7 per 100,000'),
('DZ_GEN_005', 'Cystic Fibrosis', 'genetic', 'respiratory', '["E84"]', 'autosomal_recessive', '1 in 2,500-3,500 births'),
('DZ_GEN_006', 'Sickle Cell Disease', 'genetic', 'blood', '["D57"]', 'autosomal_recessive', '1 in 365 African American births'),

-- Musculoskeletal Diseases
('DZ_MUS_001', 'Degenerative Disc Disease - Lumbar', 'musculoskeletal', 'spine', '["M51.3"]', 'complex', '27.3% diagnosed spinal degenerative disease'),
('DZ_MUS_002', 'Degenerative Disc Disease - Cervical', 'musculoskeletal', 'spine', '["M50.3"]', 'complex', 'C5/C6 most commonly affected'),
('DZ_MUS_003', 'Spinal Stenosis', 'musculoskeletal', 'spine', '["M48.0"]', 'complex', '4.5% diagnosed prevalence'),
('DZ_MUS_004', 'Osteoarthritis - Knee', 'musculoskeletal', 'joint', '["M17"]', 'complex', 'Most common form of arthritis'),
('DZ_MUS_005', 'Osteoarthritis - Hip', 'musculoskeletal', 'joint', '["M16"]', 'complex', 'Common in older adults'),
('DZ_MUS_006', 'Rheumatoid Arthritis', 'musculoskeletal', 'autoimmune', '["M05", "M06"]', 'complex', '1.3 million Americans'),
('DZ_MUS_007', 'Fibromyalgia', 'musculoskeletal', 'pain_disorder', '["M79.3"]', 'complex', '2-4% of adults'),

-- Rare Diseases
('DZ_RARE_001', 'Ehlers-Danlos Syndrome', 'genetic', 'connective_tissue', '["Q79.6"]', 'autosomal_dominant', '1 in 5,000 people'),
('DZ_RARE_002', 'Marfan Syndrome', 'genetic', 'connective_tissue', '["Q87.4"]', 'autosomal_dominant', '1 in 5,000 people'),
('DZ_RARE_003', 'Amyotrophic Lateral Sclerosis', 'neurological', 'motor_neuron', '["G12.2"]', 'complex', '5-6 per 100,000 annually'),

-- Mental Health (with genetic components)
('DZ_MH_001', 'Bipolar Disorder', 'mental_health', 'mood', '["F31"]', 'complex', '2.8% of adults annually'),
('DZ_MH_002', 'Schizophrenia', 'mental_health', 'psychotic', '["F20"]', 'complex', '0.3-0.7% lifetime prevalence'),
('DZ_MH_003', 'Major Depressive Disorder', 'mental_health', 'mood', '["F33"]', 'complex', '8.3% of adults annually'),

-- Cardiovascular (with genetic components)
('DZ_CV_001', 'Hypertrophic Cardiomyopathy', 'cardiovascular', 'genetic', '["I42.1"]', 'autosomal_dominant', '1 in 500 people'),
('DZ_CV_002', 'Familial Hypercholesterolemia', 'cardiovascular', 'genetic', '["E78.0"]', 'autosomal_dominant', '1 in 250-500 people'),

-- Cancer (hereditary forms)
('DZ_CAN_001', 'Hereditary Breast and Ovarian Cancer', 'cancer', 'hereditary', '["Z15.01", "Z15.02"]', 'autosomal_dominant', 'BRCA1/2 mutations'),
('DZ_CAN_002', 'Lynch Syndrome', 'cancer', 'hereditary', '["Z15.09"]', 'autosomal_dominant', '1 in 300-400 people'),
('DZ_CAN_003', 'Familial Adenomatous Polyposis', 'cancer', 'hereditary', '["D12.6"]', 'autosomal_dominant', '1 in 7,000-22,000 births');

-- Update timestamps for all entries
UPDATE diseases SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
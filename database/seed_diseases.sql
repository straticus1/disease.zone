-- Seed data for diseases table
-- Initial disease entries for the platform

INSERT OR IGNORE INTO diseases (disease_code, name, category, subcategory, icd10_codes, inheritance_pattern, prevalence_description) VALUES
-- STD Diseases
('DZ_STD_001', 'Chlamydia', 'std', 'bacterial', '["A56"]', 'none', 'Most common bacterial STD in the US'),
('DZ_STD_002', 'Gonorrhea', 'std', 'bacterial', '["A54"]', 'none', 'Second most common bacterial STD'),
('DZ_STD_003', 'Syphilis', 'std', 'bacterial', '["A50", "A51", "A52", "A53"]', 'none', 'Bacterial infection with multiple stages'),
('DZ_STD_004', 'Herpes Simplex Virus Type 1 (HSV-1)', 'std', 'viral', '["B00.1", "B00.2", "B00.3", "B00.9"]', 'none', '67% of population under 50 globally infected'),
('DZ_STD_005', 'Herpes Simplex Virus Type 2 (HSV-2)', 'std', 'viral', '["A60.0", "A60.1", "A60.9", "B00.1"]', 'none', '13% of population 15-49 globally infected'),
('DZ_STD_006', 'Trichomoniasis', 'std', 'parasitic', '["A59.0", "A59.8", "A59.9"]', 'none', 'Most common curable STI - 156 million new cases annually worldwide'),
('DZ_STD_007', 'Phthirus pubis (Pubic Lice/Crabs)', 'std', 'parasitic', '["B85.3"]', 'none', 'Ectoparasitic infestation - highly contagious through close contact'),

-- Neurological Diseases
('DZ_NEU_001', 'Alzheimer''s Disease', 'neurological', 'dementia', '["F03", "G30"]', 'complex', '6.9 million Americans age 65+'),
('DZ_NEU_002', 'Frontotemporal Dementia', 'neurological', 'dementia', '["F02"]', 'complex', 'Less common form of dementia'),
('DZ_NEU_003', 'Vascular Dementia', 'neurological', 'dementia', '["F01"]', 'complex', 'Second most common dementia type'),
('DZ_NEU_004', 'Trigeminal Neuralgia', 'neurological', 'pain_disorder', '["G50.0"]', 'complex', '12-15 per 100,000 people'),
('DZ_NEU_005', 'Multiple Sclerosis', 'neurological', 'autoimmune', '["G35"]', 'complex', '1 million Americans affected'),
('DZ_NEU_006', 'Shingles (Herpes Zoster)', 'neurological', 'viral_reactivation', '["B02.0", "B02.1", "B02.2", "B02.3", "B02.8", "B02.9"]', 'none', '1 in 3 people will develop shingles in their lifetime'),

-- Genetic Diseases
('DZ_GEN_001', 'Autosomal Dominant Polycystic Kidney Disease', 'genetic', 'kidney', '["Q61.2"]', 'autosomal_dominant', '1 in 400-1000 people'),
('DZ_GEN_002', 'Autosomal Recessive Polycystic Kidney Disease', 'genetic', 'kidney', '["Q61.1"]', 'autosomal_recessive', '1 in 20,000 births'),
('DZ_GEN_003', 'Systemic Lupus Erythematosus', 'genetic', 'autoimmune', '["M32"]', 'complex', '1.5 million Americans'),
('DZ_GEN_004', 'Huntington''s Disease', 'genetic', 'neurological', '["G10"]', 'autosomal_dominant', '3-7 per 100,000'),
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
('DZ_CAN_003', 'Familial Adenomatous Polyposis', 'cancer', 'hereditary', '["D12.6"]', 'autosomal_dominant', '1 in 7,000-22,000 births'),

-- Cardiovascular Diseases
('DZ_CV_003', 'Coronary Artery Disease', 'cardiovascular', 'ischemic', '["I25.1", "I25.10", "I25.110", "I25.111"]', 'complex', 'Leading cause of death - 18.2 million adults'),
('DZ_CV_004', 'Myocardial Infarction (Heart Attack)', 'cardiovascular', 'acute', '["I21.0", "I21.1", "I21.2", "I21.3", "I21.4", "I21.9"]', 'complex', '805,000 heart attacks annually in US'),
('DZ_CV_005', 'Heart Failure', 'cardiovascular', 'chronic', '["I50.1", "I50.20", "I50.21", "I50.22", "I50.23", "I50.9"]', 'complex', '6.2 million adults in US'),
('DZ_CV_006', 'Atrial Fibrillation', 'cardiovascular', 'arrhythmia', '["I48.0", "I48.1", "I48.2", "I48.91"]', 'complex', '2.7-6.1 million people in US'),
('DZ_CV_007', 'Hypertension (High Blood Pressure)', 'cardiovascular', 'metabolic', '["I10", "I11.0", "I12.0", "I13.0", "I15.0"]', 'complex', '116 million adults - 45% of US adults'),
('DZ_CV_008', 'Hyperlipidemia (High Cholesterol)', 'cardiovascular', 'metabolic', '["E78.0", "E78.1", "E78.2", "E78.4", "E78.5"]', 'complex', '93 million adults age 20+ have total cholesterol >200'),

-- Diabetes and Metabolic Disorders
('DZ_MET_001', 'Type 2 Diabetes Mellitus', 'metabolic', 'diabetes', '["E11.0", "E11.1", "E11.2", "E11.3", "E11.4", "E11.5", "E11.6", "E11.7", "E11.8", "E11.9"]', 'complex', '34.2 million Americans - 10.5% of population'),
('DZ_MET_002', 'Prediabetes', 'metabolic', 'diabetes', '["R73.03", "R73.09"]', 'complex', '88 million adults - 1 in 3 US adults'),
('DZ_MET_003', 'Metabolic Syndrome', 'metabolic', 'syndrome', '["E88.81"]', 'complex', '34% of US adults have metabolic syndrome'),
('DZ_MET_004', 'Type 1 Diabetes Mellitus', 'metabolic', 'diabetes', '["E10.0", "E10.1", "E10.2", "E10.3", "E10.4", "E10.5", "E10.6", "E10.7", "E10.8", "E10.9"]', 'complex', '1.6 million Americans have Type 1 diabetes'),

-- Common Cancers
('DZ_CAN_004', 'Breast Cancer', 'cancer', 'solid_tumor', '["C50.011", "C50.012", "C50.019", "C50.111", "C50.112", "C50.119", "C50.211", "C50.212", "C50.219"]', 'complex', 'Most common cancer in women - 287,850 new cases annually'),
('DZ_CAN_005', 'Prostate Cancer', 'cancer', 'solid_tumor', '["C61"]', 'complex', 'Most common cancer in men - 248,530 new cases annually'),
('DZ_CAN_006', 'Lung Cancer', 'cancer', 'solid_tumor', '["C78.00", "C78.01", "C78.02", "C34.10", "C34.11", "C34.12"]', 'complex', 'Leading cause of cancer death - 228,820 new cases annually'),
('DZ_CAN_007', 'Colorectal Cancer', 'cancer', 'solid_tumor', '["C18.0", "C18.1", "C18.2", "C19", "C20"]', 'complex', 'Third most common cancer - 147,950 new cases annually'),
('DZ_CAN_008', 'Pancreatic Cancer', 'cancer', 'solid_tumor', '["C25.0", "C25.1", "C25.2", "C25.3", "C25.7", "C25.8", "C25.9"]', 'complex', 'Fourth leading cause of cancer death - 60,430 new cases annually'),
('DZ_CAN_009', 'Melanoma', 'cancer', 'skin', '["C43.0", "C43.1", "C43.2", "C43.3", "C43.4", "C43.5", "C43.6", "C43.7", "C43.8", "C43.9"]', 'complex', 'Most serious skin cancer - 99,780 new cases annually'),
('DZ_CAN_010', 'Ovarian Cancer', 'cancer', 'gynecologic', '["C56.1", "C56.2", "C56.9"]', 'complex', 'Fifth leading cause of cancer death in women'),
('DZ_CAN_011', 'Leukemia', 'cancer', 'blood', '["C91.00", "C91.10", "C92.00", "C95.90"]', 'complex', 'Most common cancer in children and teens'),

-- Chronic Kidney Disease
('DZ_CV_009', 'Chronic Kidney Disease', 'cardiovascular', 'renal', '["N18.1", "N18.2", "N18.3", "N18.4", "N18.5", "N18.6"]', 'complex', '37 million adults have CKD - 15% of US adults'),

-- Stroke and Cerebrovascular Disease
('DZ_CV_010', 'Stroke (Cerebrovascular Accident)', 'cardiovascular', 'cerebrovascular', '["I63.00", "I63.10", "I63.20", "I61.0", "I61.1", "I61.2"]', 'complex', 'Leading cause of disability - 795,000 annually'),
('DZ_CV_011', 'Transient Ischemic Attack (TIA)', 'cardiovascular', 'cerebrovascular', '["G93.1"]', 'complex', '240,000 TIAs annually in US');

-- Update timestamps for all entries
UPDATE diseases SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
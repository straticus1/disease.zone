# Family Disease Surveillance API Documentation

## Overview

diseaseZone now includes comprehensive surveillance data for neurological, genetic, and musculoskeletal diseases that commonly affect families across generations. This expansion honors families affected by these conditions and provides valuable public health insights.

**Dedicated to families impacted by hereditary and chronic diseases - your legacy drives our mission to track and understand these conditions.**

---

## 🧠 Neurological Diseases API

### Alzheimer's Disease & Dementia

Track the leading cause of dementia affecting 6.9+ million Americans.

#### `GET /api/neurological/alzheimers`

**Query Parameters:**
- `state` (string): State code or 'all' (default: 'all')
- `year` (string): Year (default: '2024')
- `metric` (string): Specific metric or 'all' (default: 'all')

**Example Request:**
```bash
curl "https://disease.zone/api/neurological/alzheimers?state=ny&year=2024"
```

**Response:**
```json
{
  "success": true,
  "source": "CDC Alzheimer's Disease and Healthy Aging Data Portal",
  "year": "2024",
  "data": [
    {
      "state": "NY",
      "prevalence_rate": "6.2",
      "cases_per_100k": 1285,
      "mortality_rate": 42,
      "caregivers": 147000,
      "subjective_cognitive_decline": 9.8,
      "year": "2024"
    }
  ],
  "metadata": {
    "lastUpdated": "2024-12-01",
    "dataSource": "BRFSS, NHANES",
    "coverage": "US States and Territories"
  }
}
```

### Trigeminal Neuralgia

Rare neurological condition causing severe facial pain.

#### `GET /api/neurological/trigeminal-neuralgia`

**Query Parameters:**
- `state` (string): State code or 'all' (default: 'all')
- `year` (string): Year (default: '2024')

**Key Statistics:**
- Prevalence: 12-15 per 100,000 people
- Gender ratio: 3:1 female to male
- Peak onset: 50-60 years

**Response includes:**
- Estimated cases by state
- Gender distribution
- Average age of onset
- Active clinical trials

---

## 🧬 Genetic Diseases API

### Polycystic Kidney Disease (PKD)

Track the most common inherited kidney disease.

#### `GET /api/genetic/pkd`

**Query Parameters:**
- `state` (string): State code or 'all' (default: 'all')
- `year` (string): Year (default: '2024')
- `type` (string): 'adpkd', 'arpkd', or 'all' (default: 'all')

**Example Request:**
```bash
curl "https://disease.zone/api/genetic/pkd?state=ca&type=adpkd"
```

**Response:**
```json
{
  "success": true,
  "source": "CDC Kidney Disease Surveillance System, Medicare Data",
  "data": [
    {
      "state": "CA",
      "adpkd_cases": 35628,
      "arpkd_cases": 1781,
      "total_pkd_cases": 37409,
      "dialysis_patients": 34,
      "transplant_candidates": 23,
      "family_history_percent": "89.4",
      "year": "2024"
    }
  ],
  "metadata": {
    "prevalence": "1 in 400-1000 people (ADPKD)",
    "inheritance": "Autosomal dominant (90%) and recessive (10%)",
    "kidney_failure_rate": "50% by age 60 (ADPKD)"
  }
}
```

### Lupus (Systemic Lupus Erythematosus)

Autoimmune disease with genetic components.

#### `GET /api/genetic/lupus`

**Query Parameters:**
- `state` (string): State code or 'all' (default: 'all')
- `year` (string): Year (default: '2024')
- `demographic` (string): Demographic filter (default: 'all')

**Key Statistics:**
- 1.5 million Americans affected
- 90% female predominance
- 3x higher rate in African Americans
- 2.5x higher rate in Hispanic populations

---

## 🦴 Musculoskeletal Diseases API

### Degenerative Disc Disease

Track the most common cause of back pain and disability.

#### `GET /api/musculoskeletal/degenerative-disc`

**Query Parameters:**
- `state` (string): State code or 'all' (default: 'all')
- `year` (string): Year (default: '2024')
- `spineLevel` (string): 'cervical', 'thoracic', 'lumbar', or 'all'

**Example Request:**
```bash
curl "https://disease.zone/api/musculoskeletal/degenerative-disc?state=tx&spineLevel=lumbar"
```

**Response:**
```json
{
  "success": true,
  "source": "Medicare Claims Data, Wakayama Spine Study",
  "data": [
    {
      "state": "TX",
      "total_diagnosed_cases": 7835000,
      "prevalence_percent": "26.1",
      "lumbar_cases": 4301000,
      "female_prevalence": "33.2",
      "male_prevalence": "17.8",
      "over_50_prevalence": "92.1",
      "surgery_rate": "6.8",
      "year": "2024"
    }
  ],
  "metadata": {
    "overall_prevalence": "27.3% diagnosed spinal degenerative disease",
    "age_distribution": ">90% in people over 50",
    "gender_difference": "34.7% female vs 18.1% male prevalence"
  }
}
```

#### `GET /api/musculoskeletal/spine-level/:level`

Get specific data for cervical, thoracic, or lumbar spine levels.

**Most Common Affected Levels:**
- **Cervical**: C5/C6 (51.5% men, 46% women)
- **Thoracic**: T6/T7 (32.4% men, 37.7% women)
- **Lumbar**: L4/L5 (69.1% men, 75.8% women)

#### `GET /api/musculoskeletal/risk-factors`

**Query Parameters:**
- `factor` (string): 'age', 'obesity', 'diabetes', 'smoking', 'occupation', or 'all'

**Key Risk Factors:**
- **Age**: Strongest predictor (>90% over 50 show degeneration)
- **Obesity**: 1.5-2x increased risk
- **Diabetes**: 1.469 odds ratio
- **Smoking**: 2-3x increased risk

---

## Summary Endpoints

Each disease category provides comprehensive summary statistics:

### `GET /api/neurological/summary`
- Total US cases for neurological conditions
- Economic burden and caregiver statistics
- Research funding and trends

### `GET /api/genetic/summary`
- Inheritance patterns and family risk
- Genetic counseling recommendations
- Population demographics

### `GET /api/musculoskeletal/summary`
- Global burden and disability statistics
- Surgical intervention rates
- Economic impact

---

## Disease Lists

### `GET /api/neurological/diseases`
### `GET /api/genetic/diseases`
### `GET /api/musculoskeletal/diseases`

Returns available diseases, prevalence data, and data sources for each category.

---

## Data Sources

### CDC Sources
- **Alzheimer's Disease and Healthy Aging Data Portal**: https://nccd.cdc.gov/aging_data/
- **Chronic Kidney Disease Surveillance System**: https://nccd.cdc.gov/ckd/
- **BRFSS (Behavioral Risk Factor Surveillance System)**
- **NHANES (National Health and Nutrition Examination Survey)**

### NIH Sources
- **Genetic and Rare Diseases Information Center (GARD)**
- **National Institute of Neurological Disorders and Stroke (NINDS)**
- **NIH Osteoarthritis Initiative**

### Academic Sources
- **Wakayama Spine Study**: Population-based MRI analysis
- **Medicare Claims Data**: Large-scale prevalence analysis
- **Clinical Literature**: Peer-reviewed research studies

---

## Family Heritage Integration

### Understanding Inheritance Patterns

**Autosomal Dominant (PKD)**
- 50% chance if one parent affected
- Symptoms typically appear 30-40 years
- Family screening recommended

**Complex Inheritance (Lupus, Alzheimer's)**
- Multiple genetic factors
- Environmental triggers important
- Family history increases risk

**Age-Related Degeneration (DDD)**
- Not directly inherited
- Genetic predisposition possible
- Lifestyle factors significant

### Family Screening Recommendations

1. **PKD**: Genetic testing and imaging for family members
2. **Alzheimer's**: Cognitive assessments and lifestyle interventions
3. **Trigeminal Neuralgia**: Symptom awareness and family history documentation
4. **Lupus**: Autoimmune marker monitoring
5. **Degenerative Disc Disease**: Preventive care and ergonomic education

---

## Memorial and Legacy Features

The diseaseZone platform honors families affected by these conditions by:

- **Tracking disease progression** to help future generations
- **Providing research data** that advances treatment
- **Supporting family awareness** of hereditary risks
- **Documenting prevalence trends** for public health planning

*"In memory of those we've lost and in support of those still fighting - your legacy lives on through better understanding and prevention of these diseases."*

---

## Usage Examples

### Family History Analysis
```bash
# Check PKD prevalence in your state
curl "https://disease.zone/api/genetic/pkd?state=ny"

# Get trigeminal neuralgia statistics
curl "https://disease.zone/api/neurological/trigeminal-neuralgia?state=ca"

# Analyze spine health in your region
curl "https://disease.zone/api/musculoskeletal/degenerative-disc?state=fl"
```

### Research and Advocacy
```bash
# Get comprehensive summaries for grant applications
curl "https://disease.zone/api/neurological/summary"
curl "https://disease.zone/api/genetic/summary"

# Risk factor analysis for education
curl "https://disease.zone/api/musculoskeletal/risk-factors?factor=age"
```

---

## Support and Community

- **API Documentation**: Full endpoint reference at `/api/std/status`
- **Data Updates**: Real-time surveillance from multiple federal sources
- **Research Collaboration**: Contact information for academic partnerships
- **Family Resources**: Links to patient advocacy organizations

diseaseZone stands as a testament to the power of data in honoring family legacies while advancing public health understanding of the diseases that affect our loved ones.
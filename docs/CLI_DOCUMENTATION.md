# diseaseZone CLI Documentation

## Overview

The diseaseZone CLI is a comprehensive command-line interface for managing family disease tracking, user accounts, and medical data. Enhanced with modern UI components including professional table formatting, interactive prompts, and loading indicators for an optimal command-line experience.

## ✨ New in v1.7.2

- **🎨 Professional Table Formatting** - Beautiful data tables with borders, colors, and alignment using `cli-table3`
- **💬 Interactive User Prompts** - Sophisticated command-line interactions with `inquirer` for guided workflows
- **🔄 Loading Indicators** - Elegant spinners and progress feedback with `ora` for better user experience
- **🔌 Platform Synchronization** - CLI fully synchronized with web platform features and capabilities
- **📊 Enhanced Data Presentation** - Improved visual formatting across all commands and outputs

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Make CLI executable:**
   ```bash
   chmod +x cli.js
   ```

3. **Link globally (optional):**
   ```bash
   npm link
   ```

4. **Test installation:**
   ```bash
   node cli.js --help
   # or if linked globally:
   diseasezone --help
   ```

## Quick Start

1. **Register a new account:**
   ```bash
   diseasezone auth register
   ```

2. **Login to your account:**
   ```bash
   diseasezone auth login
   ```

3. **View available diseases:**
   ```bash
   diseasezone diseases list
   ```

4. **Add a family disease record:**
   ```bash
   diseasezone family add --disease-id 1 --member mother --has-disease true
   ```

## Global Options

- `-s, --server <url>`: Server URL (default: http://localhost:3000)
- `-f, --format <type>`: Output format: table, json, csv (default: table)
- `-v, --verbose`: Enable verbose output
- `--help`: Show help information

## Commands

### Authentication (`auth`)

Manage user authentication and sessions.

#### `auth login`
Login to your diseaseZone account.

**Options:**
- `-e, --email <email>`: Email address
- `-p, --password <password>`: Password

**Examples:**
```bash
# Interactive login
diseasezone auth login

# Direct login
diseasezone auth login -e john@example.com -p mypassword
```

#### `auth register`
Register a new user account.

**Options:**
- `-f, --first-name <name>`: First name
- `-l, --last-name <name>`: Last name
- `-e, --email <email>`: Email address
- `-p, --password <password>`: Password
- `-r, --role <role>`: Account role: user, medical_professional
- `--license <number>`: Medical license number (medical professionals)
- `--specialty <specialty>`: Medical specialty (medical professionals)
- `--institution <institution>`: Institution name (medical professionals)

**Examples:**
```bash
# Interactive registration
diseasezone auth register

# Direct registration for user
diseasezone auth register -f John -l Doe -e john@example.com -p SecurePass123! -r user

# Medical professional registration
diseasezone auth register -f Dr. -l Smith -e drsmith@hospital.com -p SecurePass123! -r medical_professional --license MD123456 --specialty "Internal Medicine" --institution "General Hospital"
```

#### `auth logout`
Logout and clear your session.

#### `auth status`
Show current authentication status and user information.

### User Management (`user`)

Manage user profiles and account information.

#### `user profile`
View your user profile and account details.

#### `user update`
Update your user profile information.

**Options:**
- `-f, --first-name <name>`: Update first name
- `-l, --last-name <name>`: Update last name
- `--license <number>`: Update medical license number
- `--specialty <specialty>`: Update medical specialty
- `--institution <institution>`: Update institution name

**Examples:**
```bash
# Update name
diseasezone user update -f Jane -l Smith

# Update medical information
diseasezone user update --specialty "Cardiology" --institution "Heart Center"
```

### Disease Registry (`diseases`)

Browse and search the disease registry.

#### `diseases list`
List all diseases in the registry.

**Options:**
- `-c, --category <category>`: Filter by category
- `-s, --search <term>`: Search disease names
- `--limit <number>`: Limit number of results

**Examples:**
```bash
# List all diseases
diseasezone diseases list

# Filter by category
diseasezone diseases list -c neurological

# Search for specific diseases
diseasezone diseases list -s "kidney disease"

# Limit results
diseasezone diseases list --limit 10
```

#### `diseases info <disease-id>`
Get detailed information about a specific disease.

**Examples:**
```bash
# Get disease info by ID
diseasezone diseases info 1

# Get disease info by name
diseasezone diseases info "Alzheimer's Disease"

# Get disease info by code
diseasezone diseases info DZ_NEU_001
```

#### `diseases categories`
List all disease categories with statistics.

#### `diseases search`
Advanced disease search with multiple filters.

**Options:**
- `-q, --query <query>`: Search query
- `-c, --category <category>`: Category filter
- `--icd10 <code>`: ICD-10 code filter
- `--inheritance <pattern>`: Inheritance pattern filter

**Examples:**
```bash
# Search with query
diseasezone diseases search -q "polycystic kidney"

# Filter by category and inheritance
diseasezone diseases search -c genetic --inheritance "autosomal dominant"
```

### Family Disease Tracking (`family`)

Manage family disease records and health history.

#### `family list`
List your family disease records.

**Options:**
- `-m, --member <member>`: Filter by family member
- `-d, --disease <disease>`: Filter by disease

**Examples:**
```bash
# List all family records
diseasezone family list

# Filter by family member
diseasezone family list -m mother

# Filter by disease
diseasezone family list -d "Alzheimer's Disease"
```

#### `family add`
Add a new family disease record.

**Required Options:**
- `-d, --disease-id <id>`: Disease ID from registry
- `-m, --member <member>`: Family member (mother, father, sibling, child, grandmother, grandfather, aunt, uncle, cousin)

**Optional Options:**
- `-n, --name <name>`: Family member's name
- `--has-disease <boolean>`: Family member has disease (true/false)
- `--confirmed <boolean>`: Diagnosis confirmed (true/false)
- `--date <date>`: Diagnosis date (YYYY-MM-DD)
- `--symptoms <symptoms>`: Current symptoms (comma-separated)
- `--past-symptoms <symptoms>`: Past symptoms (comma-separated)
- `--has-children <boolean>`: Family member has children (true/false)
- `--children-count <number>`: Number of children
- `--children-affected <boolean>`: Children have disease (true/false)
- `--notes <notes>`: Additional notes
- `--treatments <treatments>`: Treatment history (comma-separated)

**Examples:**
```bash
# Basic family disease record
diseasezone family add -d 1 -m mother --has-disease true

# Detailed record with all information
diseasezone family add \
  -d 1 -m mother -n "Mary Smith" \
  --has-disease true --confirmed true --date 2020-05-15 \
  --symptoms "pain,stiffness" --past-symptoms "swelling" \
  --has-children true --children-count 2 --children-affected false \
  --notes "Diagnosed at age 45, managed with medication" \
  --treatments "medication,physical therapy"
```

#### `family update <record-id>`
Update an existing family disease record.

**Options:** Same as `family add` (all optional)

**Examples:**
```bash
# Update symptoms
diseasezone family update 1 --symptoms "pain,fatigue,stiffness"

# Update diagnosis status
diseasezone family update 1 --confirmed true --date 2023-01-15
```

#### `family delete <record-id>`
Delete a family disease record.

**Options:**
- `-y, --yes`: Skip confirmation prompt

**Examples:**
```bash
# Delete with confirmation
diseasezone family delete 1

# Delete without confirmation
diseasezone family delete 1 -y
```

#### `family info <record-id>`
Get detailed information about a specific family disease record.

### API Key Management (`apikeys`)

**Note:** Only available for medical professionals.

#### `apikeys list`
List all your API keys.

#### `apikeys create`
Create a new API key.

**Required Options:**
- `-n, --name <name>`: API key name

**Optional Options:**
- `-p, --permissions <permissions>`: Comma-separated permissions
- `-r, --rate-limit <limit>`: Rate limit per hour

**Examples:**
```bash
# Basic API key
diseasezone apikeys create -n "Clinical Research API"

# API key with specific permissions and rate limit
diseasezone apikeys create \
  -n "Hospital System Integration" \
  -p "read_all_data,write_disease_data" \
  -r 5000
```

#### `apikeys revoke <key-id>`
Revoke an API key.

**Options:**
- `-y, --yes`: Skip confirmation prompt

#### `apikeys info <key-id>`
Get detailed information about an API key.

### Batch Operations (`batch`)

**⚠️ Experimental Feature:** These operations are experimental and should be used with caution.

#### `batch import <file>`
Import data from CSV or JSON file.

**Options:**
- `-t, --type <type>`: Data type (currently only "family-diseases" supported)
- `--dry-run`: Preview changes without applying
- `--validate-only`: Only validate data format

**Examples:**
```bash
# Import family disease data
diseasezone batch import family-diseases.json -t family-diseases

# Validate data without importing
diseasezone batch import family-diseases.csv --validate-only

# Preview import
diseasezone batch import family-diseases.json --dry-run
```

#### `batch export <output-file>`
Export data to CSV or JSON file.

**Options:**
- `-t, --type <type>`: Data type: diseases, family-diseases, profile
- `-f, --format <format>`: Output format: csv, json

**Examples:**
```bash
# Export family diseases as JSON
diseasezone batch export my-family-diseases.json -t family-diseases

# Export all diseases as CSV
diseasezone batch export diseases.csv -t diseases -f csv

# Export user profile
diseasezone batch export profile.json -t profile
```

#### `batch template <type> <output-file>`
Generate import template.

**Options:**
- `-f, --format <format>`: Template format: csv, json

**Examples:**
```bash
# Generate JSON template
diseasezone batch template family-diseases template.json

# Generate CSV template
diseasezone batch template family-diseases template.csv -f csv
```

### Configuration (`config`)

Manage CLI configuration settings.

#### `config show`
Show current CLI configuration.

#### `config set <key> <value>`
Set a configuration value.

**Valid Keys:**
- `server_url`: Server URL
- `output_format`: Output format (table, json, csv)
- `verbose`: Verbose mode (true/false)

**Examples:**
```bash
# Change server URL
diseasezone config set server_url https://api.disease.zone

# Change output format
diseasezone config set output_format json

# Enable verbose mode
diseasezone config set verbose true
```

#### `config reset`
Reset configuration to defaults.

**Options:**
- `-y, --yes`: Skip confirmation prompt

## Output Formats

The CLI supports three output formats:

1. **table** (default): Human-readable tabular format
2. **json**: JSON format for programmatic use
3. **csv**: CSV format for spreadsheet import

Change the format globally:
```bash
diseasezone config set output_format json
```

Or use for a single command:
```bash
diseasezone diseases list --format csv
```

## Data Import/Export Formats

### Family Disease Records

#### JSON Format
```json
[
  {
    "disease_id": 1,
    "family_member": "mother",
    "family_member_name": "Mary Smith",
    "has_disease": true,
    "diagnosis_confirmed": true,
    "diagnosis_date": "2020-05-15",
    "family_member_has_symptoms": ["pain", "stiffness"],
    "family_member_had_symptoms": ["swelling"],
    "family_member_has_children": true,
    "family_member_children_count": 2,
    "family_member_children_have_disease": false,
    "family_member_disease_notes": "Diagnosed at age 45, managed with medication",
    "treatment_history": ["medication", "physical_therapy"]
  }
]
```

#### CSV Format
```csv
disease_id,family_member,family_member_name,has_disease,diagnosis_confirmed,diagnosis_date,family_member_has_symptoms,family_member_had_symptoms,family_member_has_children,family_member_children_count,family_member_children_have_disease,family_member_disease_notes,treatment_history
1,mother,Mary Smith,true,true,2020-05-15,"pain;stiffness","swelling",true,2,false,"Diagnosed at age 45, managed with medication","medication;physical_therapy"
```

**Note:** In CSV format, array fields use semicolon (`;`) as separator.

## Error Handling

The CLI provides detailed error messages and exit codes:

- **0**: Success
- **1**: General error (authentication, validation, network, etc.)

Common error scenarios:
- **Authentication required**: Use `diseasezone auth login`
- **Invalid permissions**: Medical professional features require medical professional account
- **Network errors**: Check server URL and connectivity
- **Validation errors**: Check data format and required fields

## Configuration File

The CLI stores configuration in `~/.diseasezone`:

```json
{
  "server_url": "http://localhost:3000",
  "auth_token": "jwt_token_here",
  "user_email": "user@example.com",
  "user_role": "user",
  "output_format": "table",
  "verbose": false
}
```

## Examples and Use Cases

### Scenario 1: First-time User Setup
```bash
# Register new account
diseasezone auth register

# View available diseases
diseasezone diseases list

# Add family history for mother with PKD
diseasezone family add -d 1 -m mother --has-disease true --confirmed true
```

### Scenario 2: Medical Professional Workflow
```bash
# Register as medical professional
diseasezone auth register -r medical_professional

# Create API key for research
diseasezone apikeys create -n "Research API" -p "read_all_data,write_disease_data"

# Export disease data for analysis
diseasezone batch export diseases.csv -t diseases -f csv
```

### Scenario 3: Family Health Documentation
```bash
# Create detailed family health record
diseasezone family add \
  -d 4 -m grandmother -n "Helen Johnson" \
  --has-disease true --confirmed true --date 1995-03-20 \
  --symptoms "memory_loss,confusion" \
  --has-children true --children-count 3 --children-affected false \
  --notes "Early-onset Alzheimer's, diagnosed at 62" \
  --treatments "donepezil,cognitive_therapy"

# Export family data for medical appointment
diseasezone batch export family-history.pdf -t family-diseases
```

### Scenario 4: Bulk Data Management
```bash
# Generate import template
diseasezone batch template family-diseases import-template.csv -f csv

# Validate data before import
diseasezone batch import family-data.csv --validate-only

# Import with dry run preview
diseasezone batch import family-data.csv --dry-run

# Perform actual import
diseasezone batch import family-data.csv -t family-diseases
```

## Security Notes

- **Authentication tokens** are stored locally in `~/.diseasezone`
- **API keys** are only shown once during creation
- **Passwords** are never stored locally
- Use `diseasezone auth logout` to clear local authentication
- Use `diseasezone config reset` to clear all local data

## Support

For issues or questions:
- Check the help system: `diseasezone <command> --help`
- View configuration: `diseasezone config show`
- Check authentication: `diseasezone auth status`
- Reset if needed: `diseasezone config reset`

## Legacy Memorial

This CLI honors the memory of family members affected by these diseases and supports the ongoing fight against genetic and hereditary conditions. Each command and feature is designed to help families track, understand, and contribute to research on diseases like:

- **Polycystic Kidney Disease (PKD)** - DZ_GEN_001, DZ_GEN_002
- **Trigeminal Neuralgia** - DZ_NEU_004
- **Alzheimer's Disease** - DZ_NEU_001
- **Lupus** - DZ_GEN_003
- **Degenerative Disc Disease** - DZ_MUS_001, DZ_MUS_002

*"In memory of those we've lost and in support of those still fighting - your legacy lives on through better understanding and prevention of these diseases."*
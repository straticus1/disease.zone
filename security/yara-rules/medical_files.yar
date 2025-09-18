/*
    YARA Rules for Medical File Security
    Designed to detect threats and suspicious patterns in medical files
    including DICOM, HL7, FHIR, and other healthcare data formats
*/

import "pe"
import "elf"

rule Executable_in_Medical_File : suspicious
{
    meta:
        description = "Detects executable files embedded in medical data"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "high"
        category = "malware"
        
    strings:
        $pe_header = { 4D 5A }  // MZ header for PE files
        $elf_header = { 7F 45 4C 46 }  // ELF header
        $dicom_header = "DICM"
        $fhir_header = "\"resourceType\""
        $hl7_header = "MSH|"
        
    condition:
        ($dicom_header or $fhir_header or $hl7_header) and
        ($pe_header or $elf_header) and
        filesize < 500MB
}

rule Script_in_DICOM : suspicious
{
    meta:
        description = "Detects script content in DICOM files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "suspicious"
        
    strings:
        $dicom = "DICM" at 128
        $script1 = "<script"
        $script2 = "javascript:"
        $script3 = "eval("
        $script4 = "document.write"
        $script5 = "window.location"
        $powershell = "powershell"
        $cmd = "cmd.exe"
        
    condition:
        $dicom and any of ($script*, $powershell, $cmd)
}

rule Suspicious_FHIR_Resource : suspicious
{
    meta:
        description = "Detects suspicious content in FHIR resources"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "suspicious"
        
    strings:
        $fhir = "\"resourceType\""
        $base64_large = /\"[A-Za-z0-9+\/]{500,}={0,2}\"/
        $url_suspicious = /\"https?:\/\/[^\"]*\.(tk|ml|ga|cf|exe|scr|bat|cmd)\"/
        $exec_call = "exec("
        $system_call = "system("
        
    condition:
        $fhir and ($base64_large or $url_suspicious or $exec_call or $system_call)
}

rule HL7_Message_Anomaly : suspicious
{
    meta:
        description = "Detects anomalies in HL7 messages"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "suspicious"
        
    strings:
        $hl7_header = "MSH|"
        $long_field = /\|[^\|\r\n]{1000,}/
        $binary_data = /\|[A-Za-z0-9+\/]{200,}={0,2}\|/
        $suspicious_chars = /[\x00-\x08\x0E-\x1F\x7F-\xFF]{10,}/
        
    condition:
        $hl7_header and ($long_field or $binary_data or $suspicious_chars)
}

rule Medical_File_Crypto_Ransomware : malware
{
    meta:
        description = "Detects potential ransomware targeting medical files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "critical"
        category = "malware"
        
    strings:
        $ransom1 = "your files have been encrypted"
        $ransom2 = "pay the ransom"
        $ransom3 = "bitcoin address"
        $ransom4 = "decryption key"
        $crypto1 = "CryptGenRandom"
        $crypto2 = "CryptAcquireContext"
        $medical1 = ".dcm"
        $medical2 = ".nii"
        $medical3 = "DICOM"
        $medical4 = "HL7"
        
    condition:
        any of ($ransom*) and any of ($crypto*) and any of ($medical*)
}

rule Suspicious_Network_References : suspicious
{
    meta:
        description = "Detects suspicious network references in medical files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "network"
        
    strings:
        $url1 = /https?:\/\/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/
        $url2 = /https?:\/\/[^\/\s]*\.(tk|ml|ga|cf|bit\.ly|tinyurl)/
        $ftp = /ftp:\/\/[^\s]+/
        $tor = /[a-z2-7]{16}\.onion/
        $bitcoin = /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/
        
    condition:
        any of them
}

rule High_Entropy_Medical_File : suspicious
{
    meta:
        description = "Detects medical files with suspiciously high entropy"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "low"
        category = "analysis"
        
    condition:
        // This would require entropy calculation in the scanning engine
        // Placeholder for entropy-based detection
        filesize > 1KB and filesize < 100MB
}

rule PDF_with_Embedded_Medical_Data : info
{
    meta:
        description = "Detects PDF files containing medical data references"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "info"
        category = "classification"
        
    strings:
        $pdf = "%PDF"
        $medical1 = "DICOM"
        $medical2 = "HL7"
        $medical3 = "FHIR"
        $medical4 = "Patient ID"
        $medical5 = "Medical Record"
        $js_pdf = "/JavaScript"
        $action_pdf = "/OpenAction"
        
    condition:
        $pdf at 0 and any of ($medical*) and ($js_pdf or $action_pdf)
}

rule Medical_Image_Metadata_Exposure : info
{
    meta:
        description = "Detects potential PII in medical image metadata"
        author = "Medical Security Team" 
        date = "2025-09-18"
        severity = "info"
        category = "privacy"
        
    strings:
        $dicom = "DICM"
        $patient_name = /Patient['\s]*Name[^a-zA-Z0-9]*[A-Z][a-z]+[,\s]+[A-Z][a-z]+/
        $patient_id = /Patient['\s]*ID[^0-9]*[0-9]{6,}/
        $ssn = /[0-9]{3}-[0-9]{2}-[0-9]{4}/
        $date_of_birth = /19[0-9]{2}|20[0-9]{2}/
        
    condition:
        $dicom and ($patient_name or $patient_id or $ssn or $date_of_birth)
}

rule Archive_with_Medical_Files : info
{
    meta:
        description = "Detects archives containing medical files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "info"
        category = "classification"
        
    strings:
        $zip = "PK"
        $rar = "Rar!"
        $7z = "7z"
        $dicom_ext = ".dcm"
        $nifti_ext = ".nii"
        $hl7_ext = ".hl7"
        $encrypted = "AES" 
        
    condition:
        ($zip at 0 or $rar at 0 or $7z at 0) and 
        any of ($dicom_ext, $nifti_ext, $hl7_ext) and
        not $encrypted
}

rule Suspicious_Base64_in_Medical_File : suspicious
{
    meta:
        description = "Detects suspicious large base64 content in medical files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "encoding"
        
    strings:
        $base64_large = /[A-Za-z0-9+\/]{1000,}={0,2}/
        $medical_format = "DICM" or "resourceType" or "MSH|"
        
    condition:
        $medical_format and $base64_large
}

rule Medical_Steganography : suspicious
{
    meta:
        description = "Detects potential steganography in medical images"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "steganography"
        
    strings:
        $dicom = "DICM"
        $png = "\x89PNG"
        $jpeg = "\xFF\xD8\xFF"
        $steg1 = "steghide"
        $steg2 = "outguess"
        $steg3 = "F5"
        $hidden = "hidden"
        $secret = "secret"
        
    condition:
        ($dicom or $png at 0 or $jpeg at 0) and 
        any of ($steg*, $hidden, $secret)
}

rule Medical_Database_Dump : info
{
    meta:
        description = "Detects potential medical database dumps"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "info"
        category = "database"
        
    strings:
        $sql1 = "INSERT INTO"
        $sql2 = "CREATE TABLE"
        $sql3 = "SELECT * FROM"
        $medical1 = "patient"
        $medical2 = "diagnosis"
        $medical3 = "treatment"
        $medical4 = "medical_record"
        $medical5 = "healthcare"
        
    condition:
        any of ($sql*) and any of ($medical*)
}

rule Obfuscated_Medical_Script : suspicious
{
    meta:
        description = "Detects obfuscated scripts in medical files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "high"
        category = "obfuscation"
        
    strings:
        $obfusc1 = /eval\s*\(\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/
        $obfusc2 = /String\.fromCharCode\s*\(/
        $obfusc3 = /unescape\s*\(/
        $obfusc4 = /[a-zA-Z]{50,}/  // Long variable names
        $medical = "DICM" or "resourceType" or "MSH|"
        
    condition:
        $medical and any of ($obfusc*)
}

rule Medical_File_Password_Protection : info
{
    meta:
        description = "Detects password-protected medical files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "info"
        category = "encryption"
        
    strings:
        $password1 = "password"
        $password2 = "encrypted"
        $password3 = "protected"
        $medical = "medical" or "patient" or "DICOM" or "HL7"
        
    condition:
        any of ($password*) and $medical
}
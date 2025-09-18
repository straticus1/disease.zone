/*
    YARA Rules for DICOM File Security
    Specialized rules for Digital Imaging and Communications in Medicine files
*/

rule DICOM_File_Structure_Validation : info
{
    meta:
        description = "Validates DICOM file structure"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "info"
        category = "validation"
        
    strings:
        $preamble = { 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 }
        $dicm = "DICM" at 128
        
    condition:
        $preamble at 0 and $dicm
}

rule DICOM_Invalid_Magic : malware
{
    meta:
        description = "Detects files with .dcm extension but invalid DICOM magic"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "high"
        category = "masquerading"
        
    condition:
        filename matches /\.dcm$/i and
        not (uint32be(128) == 0x4449434D) and  // "DICM"
        filesize > 132
}

rule DICOM_Embedded_PE : malware
{
    meta:
        description = "Detects PE executable embedded in DICOM file"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "critical"
        category = "malware"
        
    strings:
        $dicm = "DICM" at 128
        $pe_header = { 4D 5A }  // MZ
        $pe_signature = "This program cannot be run in DOS mode"
        
    condition:
        $dicm and $pe_header and $pe_signature and
        for any i in (1..#pe_header): (@pe_header[i] > 132)
}

rule DICOM_Suspicious_Transfer_Syntax : suspicious
{
    meta:
        description = "Detects suspicious transfer syntax in DICOM"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "suspicious"
        
    strings:
        $dicm = "DICM"
        $transfer_syntax_tag = { 02 00 10 00 }  // Transfer Syntax UID tag
        $custom_syntax = /1\.2\.840\.10008\.1\.2\.99\d+/  // Custom/unknown syntax
        
    condition:
        $dicm and $transfer_syntax_tag and $custom_syntax
}

rule DICOM_Large_Private_Data : suspicious
{
    meta:
        description = "Detects unusually large private data elements in DICOM"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "data_hiding"
        
    strings:
        $dicm = "DICM"
        // Private data element tags (odd group numbers)
        $private_tag = /[\x01\x03\x05\x07\x09\x0B\x0D\x0F][\x00-\xFF][\x00-\xFF][\x00-\xFF]/
        
    condition:
        $dicm and $private_tag and filesize > 50MB
}

rule DICOM_Script_Injection : malware
{
    meta:
        description = "Detects script injection in DICOM metadata"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "high"
        category = "injection"
        
    strings:
        $dicm = "DICM"
        $script1 = "<script"
        $script2 = "javascript:"
        $script3 = "eval("
        $script4 = "document.cookie"
        $script5 = "window.open"
        $script6 = "XMLHttpRequest"
        
    condition:
        $dicm and any of ($script*)
}

rule DICOM_Zip_Bomb : malware
{
    meta:
        description = "Detects potential zip bomb in compressed DICOM"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "high"
        category = "dos"
        
    strings:
        $dicm = "DICM"
        $deflate = { 78 9C }  // zlib header
        $gzip = { 1F 8B }    // gzip header
        
    condition:
        $dicm and ($deflate or $gzip) and
        filesize < 1MB  // Small file that might expand hugely
}

rule DICOM_Network_Reference : suspicious
{
    meta:
        description = "Detects network references in DICOM files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "network"
        
    strings:
        $dicm = "DICM"
        $http = /https?:\/\/[^\x00\x20]+/
        $ftp = /ftp:\/\/[^\x00\x20]+/
        $ip = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/
        
    condition:
        $dicm and any of ($http, $ftp, $ip)
}

rule DICOM_Encrypted_Payload : suspicious
{
    meta:
        description = "Detects encrypted payload in DICOM file"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "encryption"
        
    strings:
        $dicm = "DICM"
        $aes = "AES"
        $rsa = "RSA"
        $encrypted = "ENCRYPTED"
        $cipher = "CIPHER"
        
    condition:
        $dicm and any of ($aes, $rsa, $encrypted, $cipher)
}

rule DICOM_Steganography_Markers : suspicious
{
    meta:
        description = "Detects steganography markers in DICOM files"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "steganography"
        
    strings:
        $dicm = "DICM"
        $steg1 = "steghide"
        $steg2 = "outguess" 
        $steg3 = "jphide"
        $steg4 = "F5"
        $marker1 = "HIDDEN_DATA"
        $marker2 = "SECRET_MESSAGE"
        
    condition:
        $dicm and any of them
}

rule DICOM_Buffer_Overflow_Attempt : malware
{
    meta:
        description = "Detects potential buffer overflow in DICOM length fields"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "high"
        category = "exploit"
        
    strings:
        $dicm = "DICM"
        // Look for extremely large length values (0xFFFFFFFF)
        $large_length = { FF FF FF FF }
        
    condition:
        $dicm and $large_length and
        for any i in (1..#large_length): (@large_length[i] > 132 and @large_length[i] < filesize - 4)
}

rule DICOM_Invalid_VR : suspicious
{
    meta:
        description = "Detects invalid Value Representation in DICOM"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "low"
        category = "format"
        
    strings:
        $dicm = "DICM"
        // Valid VR codes (partial list)
        $valid_vr = /\x00[\x20-\x7E][\x20-\x7E]/
        
    condition:
        $dicm and not $valid_vr
}

rule DICOM_Malformed_Sequence : suspicious
{
    meta:
        description = "Detects malformed sequences in DICOM that could cause parser issues"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "medium"
        category = "parser_exploit"
        
    strings:
        $dicm = "DICM"
        $seq_delim = { FE FF 00 E0 }  // Sequence Delimiter
        $item_delim = { FE FF 0D E0 } // Item Delimiter
        
    condition:
        $dicm and $seq_delim and not $item_delim
}

rule DICOM_Pixel_Data_Anomaly : suspicious
{
    meta:
        description = "Detects anomalies in DICOM pixel data"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "low"
        category = "data_integrity"
        
    strings:
        $dicm = "DICM"
        $pixel_data_tag = { E0 7F 10 00 }  // Pixel Data tag (7FE0,0010)
        
    condition:
        $dicm and $pixel_data_tag and
        filesize > 100MB  // Unusually large for most medical images
}

rule DICOM_Private_Creator_Suspicious : info
{
    meta:
        description = "Detects suspicious private creator identifiers"
        author = "Medical Security Team"
        date = "2025-09-18"
        severity = "info"
        category = "attribution"
        
    strings:
        $dicm = "DICM"
        $suspicious1 = "HACKER"
        $suspicious2 = "MALWARE"
        $suspicious3 = "EXPLOIT" 
        $suspicious4 = "BACKDOOR"
        $suspicious5 = "PAYLOAD"
        
    condition:
        $dicm and any of ($suspicious*)
}
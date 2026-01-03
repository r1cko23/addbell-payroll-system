# Data Privacy Manual

## Green Pasture People Management Inc. HRIS System

**Version:** 1.0  
**Effective Date:** December 17, 2025  
**Last Updated:** December 17, 2025

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Organizational Structure](#2-organizational-structure)
3. [Data Inventory](#3-data-inventory)
4. [Data Processing Activities](#4-data-processing-activities)
5. [Security Measures](#5-security-measures)
6. [Data Subject Rights](#6-data-subject-rights)
7. [Data Breach Management](#7-data-breach-management)
8. [Third-Party Management](#8-third-party-management)
9. [Training and Awareness](#9-training-and-awareness)
10. [Monitoring and Compliance](#10-monitoring-and-compliance)
11. [Retention and Disposal](#11-retention-and-disposal)
12. [Appendices](#12-appendices)

---

## 1. Introduction

### 1.1 Purpose

This Data Privacy Manual outlines the policies, procedures, and practices of Green Pasture People Management Inc. ("Company") for ensuring compliance with the **Data Privacy Act of 2012 (Republic Act No. 10173)** and its Implementing Rules and Regulations ("DPA").

### 1.2 Scope

This manual applies to:

- All employees of the Company
- All personal data processed through the HRIS system
- All third-party service providers handling personal data on behalf of the Company
- All data subjects whose personal data is processed by the Company

### 1.3 Legal Framework

- Data Privacy Act of 2012 (Republic Act No. 10173)
- Implementing Rules and Regulations of the Data Privacy Act
- National Privacy Commission (NPC) Circulars and Advisories
- Related Philippine laws and regulations

### 1.4 Definitions

**Personal Data** - Refers to all types of personal information (Section 3(f), DPA)

**Sensitive Personal Information** - Refers to personal information about an individual's race, ethnic origin, marital status, age, color, religious, philosophical or political affiliations, health, education, genetic or sexual life, legal proceedings, government-issued identifiers, and specifically includes information about an individual's finances (Section 3(g), DPA)

**Personal Information Controller (PIC)** - A person or organization who controls the collection, holding, processing, or use of personal information (Section 3(i), DPA)

**Personal Information Processor (PIP)** - Any natural or juridical person qualified to act as such under the DPA to whom a personal information controller may outsource or instruct the processing of personal data (Section 3(j), DPA)

**Data Subject** - Refers to an individual whose personal information is processed (Section 3(e), DPA)

**Data Protection Officer (DPO)** - The individual designated by the Company to ensure compliance with the DPA

---

## 2. Organizational Structure

### 2.1 Personal Information Controller (PIC)

**Company Name:** Green Pasture People Management Inc.  
**Address:** 31st Floor, Unit 3101, AIC, Burgundy Empire Tower, ADB Ave, Ortigas Center, Pasig  
**Contact Number:** (02) 5310 6122  
**Email:** info@greenpasture.ph

### 2.2 Data Protection Officer (DPO)

**Name:** Jericko A. Razal  
**Position:** IT Consultant  
**Email:** jericko.razal@greenpasture.ph  
**Contact Number:** 09175257659  
**Office Address:** 31st Floor, Unit 3101, AIC, Burgundy Empire Tower, ADB Ave, Ortigas Center, Pasig

**Responsibilities:**

- Monitor compliance with the DPA and related regulations
- Ensure implementation of security measures
- Conduct privacy impact assessments
- Serve as contact person for the National Privacy Commission
- Handle data subject requests and complaints
- Conduct training and awareness programs
- Manage data breach incidents
- Review and update privacy policies and procedures

### 2.3 Data Privacy Committee

**Members:**

- Data Protection Officer (Chairperson)
- HR Manager
- IT Manager/System Administrator
- Legal Counsel (if applicable)
- Finance Manager (for payroll-related matters)

**Functions:**

- Review data privacy policies and procedures
- Assess privacy risks
- Approve data processing activities
- Review third-party agreements
- Handle data breach incidents
- Conduct regular compliance audits

---

## 3. Data Inventory

### 3.1 Categories of Personal Data Collected

#### A. Personal Information

- Full name (first name, middle initial, last name)
- Employee ID
- Date of birth
- Gender
- Profile photograph
- Residential address
- Email address
- Contact number

#### B. Employment Information

- Hire date
- Position/Job title
- Job level
- Assigned hotel/location
- Monthly rate and per-day rate
- Employment status
- Eligible for overtime status

#### C. Government Identification Numbers

- Tax Identification Number (TIN)
- Social Security System (SSS) number
- Philippine Health Insurance Corporation (PhilHealth) number
- Home Development Mutual Fund (Pag-IBIG) number

#### D. Sensitive Personal Information

- Salary and compensation details
- Payroll records
- Deductions (SSS, PhilHealth, Pag-IBIG, loans, taxes)
- Payslip information
- Clock in/out records with GPS location
- Daily attendance records
- Regular hours, overtime hours, night differential hours
- Leave requests and records
- Failure-to-log requests
- Overtime requests
- Work schedules

#### E. System Data

- Login credentials
- System access logs
- User activity logs
- IP addresses

### 3.2 Data Sources

- Direct collection from employees
- Government agencies (for verification)
- System-generated data
- Previous employers (if applicable)

### 3.3 Data Storage Locations

- **Primary Storage:** Cloud servers (Supabase)
- **Backup Storage:** [SPECIFY BACKUP LOCATION]
- **Physical Storage:** [IF APPLICABLE]

### 3.4 Data Retention Periods

- **Active Employee Records:** During employment + 3 years after termination
- **Payroll Records:** Minimum 3 years (as required by BIR)
- **Time and Attendance Records:** Minimum 3 years (as required by labor laws)
- **Leave Records:** Minimum 3 years
- **System Logs:** 1 year (for security and audit purposes)

---

## 4. Data Processing Activities

### 4.1 Collection

**Methods:**

- Employee registration forms
- Employee information updates
- Time clock entries (with GPS location)
- Leave request submissions
- Profile picture uploads
- System-generated records

**Principles:**

- Collect only necessary data
- Obtain consent when required
- Inform data subjects of purpose
- Ensure data accuracy

### 4.2 Processing

**Purposes:**

1. Employee management and administration
2. Payroll processing and compensation management
3. Time and attendance tracking
4. Leave management
5. Compliance with legal obligations
6. System security and access control

**Legal Bases:**

- Consent
- Contract (employment)
- Legal obligation
- Legitimate interest

### 4.3 Storage

**Security Measures:**

- Encryption (in transit and at rest)
- Access controls
- Role-based permissions
- Regular backups
- Secure data centers

### 4.4 Sharing and Disclosure

**Internal Sharing:**

- Authorized HR personnel
- Authorized administrators
- Authorized account managers
- System administrators

**External Sharing:**

- Government agencies (BIR, SSS, PhilHealth, Pag-IBIG) - as required by law
- Cloud service providers (Supabase) - for hosting and storage
- IT service providers - for system maintenance

**Requirements:**

- Data sharing agreements
- Security requirements
- Compliance verification

### 4.5 Access

**Access Controls:**

- Role-based access control (RBAC)
- Row-level security (RLS)
- Authentication requirements
- Access logging
- Regular access reviews

### 4.6 Disposal

**Methods:**

- Secure deletion
- Data anonymization
- Physical destruction (if applicable)

**Procedures:**

- Follow retention schedules
- Document disposal activities
- Ensure secure disposal

---

## 5. Security Measures

### 5.1 Technical Security Measures

#### A. Access Controls

- Strong password requirements
- Multi-factor authentication (if applicable)
- Role-based access control
- Row-level security policies
- Session management
- Automatic logout after inactivity

#### B. Encryption

- Data encryption in transit (HTTPS/TLS)
- Data encryption at rest
- Encrypted backups
- Encrypted database connections

#### C. Network Security

- Firewall protection
- Intrusion detection systems
- Regular security updates
- Secure network configurations

#### D. System Security

- Regular security patches
- Vulnerability assessments
- Penetration testing (if applicable)
- Secure coding practices
- Input validation
- SQL injection prevention

### 5.2 Organizational Security Measures

#### A. Policies and Procedures

- Data privacy policies
- Access control policies
- Password policies
- Incident response procedures
- Data breach procedures

#### B. Employee Training

- Data privacy training
- Security awareness training
- Regular updates and refreshers
- Role-specific training

#### C. Confidentiality

- Confidentiality agreements
- Non-disclosure agreements
- Employee code of conduct
- Disciplinary measures for violations

#### D. Access Management

- Principle of least privilege
- Regular access reviews
- Immediate revocation upon termination
- Segregation of duties

### 5.3 Physical Security Measures

- Secure office facilities
- Access controls to server rooms (if applicable)
- Secure disposal of physical documents
- Visitor management

### 5.4 Third-Party Security

- Vendor security assessments
- Data processing agreements
- Security requirements in contracts
- Regular vendor audits

---

## 6. Data Subject Rights

### 6.1 Rights Under the DPA

1. Right to be Informed
2. Right to Access
3. Right to Object
4. Right to Erasure or Blocking
5. Right to Damages
6. Right to Data Portability
7. Right to File a Complaint

### 6.2 Procedures for Exercising Rights

#### A. Request Submission

- Data subjects may submit requests in writing or via email
- Contact: Data Protection Officer
- Required information: Name, employee ID, specific request, reason (if applicable)

#### B. Request Processing

- Acknowledge receipt within 3 business days
- Verify identity
- Process request within 30 days (as required by law)
- Provide response in writing

#### C. Fees

- No fees for standard requests
- Reasonable fees may apply for excessive or repetitive requests

#### D. Denial of Requests

- Provide written explanation
- Inform of right to file complaint with NPC

### 6.3 Request Forms

[APPENDIX A: Data Subject Request Forms]

---

## 7. Data Breach Management

### 7.1 Definition

A data breach is a security incident that leads to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data.

### 7.2 Breach Response Team

- Data Protection Officer (Lead)
- IT Manager/System Administrator
- HR Manager
- Legal Counsel (if applicable)
- Management representative

### 7.3 Breach Response Procedures

#### Phase 1: Detection and Containment

1. Immediately detect and identify the breach
2. Contain the breach to prevent further damage
3. Preserve evidence
4. Document initial findings

#### Phase 2: Assessment

1. Assess the scope and impact
2. Identify affected data subjects
3. Determine the cause
4. Evaluate risks to data subjects

#### Phase 3: Notification

1. **Internal Notification:** Notify management and breach response team immediately
2. **NPC Notification:** Notify National Privacy Commission within 72 hours if breach poses a real risk of serious harm
3. **Data Subject Notification:** Notify affected data subjects within 72 hours if breach poses a real risk of serious harm

#### Phase 4: Remediation

1. Implement corrective measures
2. Strengthen security measures
3. Provide support to affected data subjects
4. Monitor for further incidents

#### Phase 5: Documentation and Review

1. Document the incident
2. Conduct post-incident review
3. Update security measures
4. Update procedures if necessary

### 7.4 Breach Notification Templates

[APPENDIX B: Breach Notification Templates]

---

## 8. Third-Party Management

### 8.1 Third-Party Categories

- Cloud service providers (Supabase)
- IT service providers
- Government agencies (for required reporting)

### 8.2 Requirements for Third Parties

- Data processing agreements
- Security requirements
- Compliance with DPA
- Confidentiality obligations
- Right to audit
- Breach notification requirements

### 8.3 Vendor Assessment

- Security assessment
- Privacy compliance review
- Contract review
- Regular audits

### 8.4 Third-Party Agreements

[APPENDIX C: Sample Data Processing Agreement]

---

## 9. Training and Awareness

### 9.1 Training Program

- Initial training for all employees
- Role-specific training
- Regular refresher training
- Updates on new regulations

### 9.2 Training Topics

- Data Privacy Act overview
- Company privacy policies
- Employee responsibilities
- Data subject rights
- Security best practices
- Incident reporting

### 9.3 Training Records

- Maintain training records
- Track completion
- Update as needed

---

## 10. Monitoring and Compliance

### 10.1 Compliance Monitoring

- Regular audits
- Access reviews
- Security assessments
- Policy compliance checks

### 10.2 Audit Schedule

- Quarterly: Access reviews
- Semi-annually: Security assessments
- Annually: Comprehensive privacy audit

### 10.3 Compliance Reporting

- Report to management
- Report to National Privacy Commission (as required)
- Document findings and actions

### 10.4 Corrective Actions

- Address non-compliance immediately
- Implement corrective measures
- Monitor effectiveness
- Update procedures if needed

---

## 11. Retention and Disposal

### 11.1 Retention Schedules

- Follow legal requirements
- Document retention periods
- Regular review of retained data

### 11.2 Disposal Procedures

- Secure deletion
- Data anonymization
- Physical destruction (if applicable)
- Document disposal activities

### 11.3 Disposal Schedule

- Regular disposal based on retention schedules
- Immediate disposal upon data subject request (if applicable)
- Secure disposal methods

---

## 12. Appendices

### Appendix A: Data Subject Request Forms

- Request for Access Form
- Request for Correction Form
- Request for Erasure Form
- Request for Data Portability Form
- Objection to Processing Form

### Appendix B: Breach Notification Templates

- Internal Breach Report Template
- NPC Breach Notification Template
- Data Subject Breach Notification Template

### Appendix C: Sample Data Processing Agreement

- Template for third-party agreements

### Appendix D: Contact Information

- Data Protection Officer contact details
- National Privacy Commission contact details
- Emergency contact information

### Appendix E: Related Policies

- Information Security Policy
- Access Control Policy
- Password Policy
- Incident Response Policy

---

## Approval

This Data Privacy Manual has been reviewed and approved by:

**Data Protection Officer:** Jericko A. Razal  
**Date:** December 17, 2025

**Management Representative:** ****\*\*****\_\_\_****\*\*****  
**Date:** **\*\***\_\_\_**\*\***

---

**This manual should be reviewed and updated at least annually or whenever there are significant changes in data processing activities or applicable laws.**
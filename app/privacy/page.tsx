"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H1, H2, H3, Body, BodySmall } from "@/components/ui/typography";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

export default function PrivacyNoticePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
            <div className="flex items-center gap-3">
              <Icon
                name="CheckCircle"
                size={IconSizes.lg}
                className="text-white"
              />
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  Privacy Notice
                </CardTitle>
                <BodySmall className="text-emerald-50 mt-1">
                  Green Pasture People Management Inc. HRIS System
                </BodySmall>
              </div>
            </div>
            <BodySmall className="text-emerald-50 mt-2">
              Effective Date: December 17, 2025 | Last Updated: December 17,
              2025
            </BodySmall>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* Introduction */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                1. Introduction
              </H2>
              <Body className="text-gray-700 leading-relaxed">
                Green Pasture People Management Inc. ("Company", "we", "us", or
                "our") respects your privacy and is committed to protecting your
                personal data in accordance with the{" "}
                <strong>
                  Data Privacy Act of 2012 (Republic Act No. 10173)
                </strong>{" "}
                and its Implementing Rules and Regulations ("DPA").
              </Body>
              <Body className="text-gray-700 leading-relaxed mt-4">
                This Privacy Notice explains how we collect, use, process,
                store, and protect your personal information when you use our
                Human Resources Information System (HRIS) and related services.
              </Body>
            </section>

            {/* Personal Information Controller */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                2. Personal Information Controller (PIC)
              </H2>
              <VStack className="gap-2">
                <Body className="text-gray-700">
                  <strong>Company Name:</strong> Green Pasture People Management
                  Inc.
                </Body>
                <Body className="text-gray-700">
                  <strong>Address:</strong> 31st Floor, Unit 3101, AIC, Burgundy
                  Empire Tower, ADB Ave, Ortigas Center, Pasig
                </Body>
                <Body className="text-gray-700">
                  <strong>Contact Number:</strong> (02) 5310 6122
                </Body>
                <Body className="text-gray-700">
                  <strong>Email:</strong> info@greenpasture.ph
                </Body>
              </VStack>
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <H3 className="font-semibold mb-2 text-emerald-800">
                  Data Protection Officer (DPO)
                </H3>
                <VStack className="gap-1">
                  <BodySmall className="text-gray-700">
                    <strong>Name:</strong> Jericko A. Razal
                  </BodySmall>
                  <BodySmall className="text-gray-700">
                    <strong>Position:</strong> IT Consultant
                  </BodySmall>
                  <BodySmall className="text-gray-700">
                    <strong>Email:</strong> jericko.razal@greenpasture.ph
                  </BodySmall>
                  <BodySmall className="text-gray-700">
                    <strong>Contact Number:</strong> 09175257659
                  </BodySmall>
                  <BodySmall className="text-gray-700">
                    <strong>Office Address:</strong> 31st Floor, Unit 3101, AIC,
                    Burgundy Empire Tower, ADB Ave, Ortigas Center, Pasig
                  </BodySmall>
                </VStack>
              </div>
            </section>

            {/* Personal Data We Collect */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                3. Personal Data We Collect
              </H2>

              <H3 className="font-semibold mb-2 text-gray-800">
                3.1 Personal Information
              </H3>
              <Body className="text-gray-700 mb-4">
                We collect the following personal information from employees:
              </Body>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-6">
                <li>
                  <strong>Identity Information:</strong> Full name, Employee ID,
                  Date of birth, Gender, Profile photograph
                </li>
                <li>
                  <strong>Contact Information:</strong> Residential address,
                  Email address, Contact number
                </li>
                <li>
                  <strong>Employment Information:</strong> Hire date, Position,
                  Job level, Assigned location, Salary rates, Employment status
                </li>
                <li>
                  <strong>Government Identification Numbers:</strong> TIN, SSS
                  number, PhilHealth number, Pag-IBIG number
                </li>
                <li>
                  <strong>Benefits Information:</strong> HMO provider, Leave
                  credits, Offset hours
                </li>
              </ul>

              <H3 className="font-semibold mb-2 text-gray-800">
                3.2 Sensitive Personal Information
              </H3>
              <Body className="text-gray-700 mb-4">
                We also process <strong>sensitive personal information</strong>{" "}
                as defined under the DPA:
              </Body>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-6">
                <li>
                  <strong>Financial Information:</strong> Salary, Payroll
                  records, Deductions, Payslip information
                </li>
                <li>
                  <strong>Time and Attendance Data:</strong> Clock in/out
                  records, GPS location data, Daily attendance, Overtime and
                  night differential hours
                </li>
                <li>
                  <strong>Leave and Time-Off Records:</strong> Leave requests,
                  Approval records, Failure-to-log requests, Overtime requests
                </li>
                <li>
                  <strong>Schedule Information:</strong> Work schedules, Shift
                  assignments
                </li>
              </ul>
            </section>

            {/* Purpose of Data Processing */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                4. Purpose of Data Processing
              </H2>
              <Body className="text-gray-700 mb-4">
                We process your personal data for the following legitimate
                purposes:
              </Body>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>
                  <strong>Employee Management:</strong> Maintaining employee
                  records, processing employment applications, managing
                  assignments
                </li>
                <li>
                  <strong>Payroll Processing:</strong> Calculating salaries,
                  processing government contributions, generating payslips
                </li>
                <li>
                  <strong>Time and Attendance Management:</strong> Recording
                  work hours, verifying attendance, calculating overtime
                </li>
                <li>
                  <strong>Leave Management:</strong> Processing leave requests,
                  tracking leave credits
                </li>
                <li>
                  <strong>Compliance and Legal Obligations:</strong> Complying
                  with Philippine labor laws, tax regulations, social security
                  requirements
                </li>
                <li>
                  <strong>System Security:</strong> Authenticating access,
                  monitoring usage, preventing unauthorized access
                </li>
              </ul>
            </section>

            {/* Legal Basis */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                5. Legal Basis for Processing
              </H2>
              <Body className="text-gray-700 mb-4">
                We process your personal data based on the following legal bases
                under the DPA:
              </Body>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>
                  <strong>Consent</strong> - You have given your consent to the
                  processing
                </li>
                <li>
                  <strong>Contract</strong> - Processing is necessary for the
                  performance of your employment contract
                </li>
                <li>
                  <strong>Legal Obligation</strong> - Processing is necessary
                  for compliance with legal obligations
                </li>
                <li>
                  <strong>Legitimate Interest</strong> - Processing is necessary
                  for legitimate business interests
                </li>
              </ul>
            </section>

            {/* Data Security */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                6. Data Security Measures
              </H2>
              <Body className="text-gray-700 mb-4">
                We implement appropriate technical and organizational security
                measures to protect your personal data:
              </Body>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication mechanisms</li>
                <li>Role-based access control (RBAC)</li>
                <li>Row-level security (RLS) policies</li>
                <li>Regular security updates and patches</li>
                <li>Employee training on data privacy</li>
                <li>Access controls and user permissions</li>
              </ul>
            </section>

            {/* Data Retention */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                7. Data Retention
              </H2>
              <Body className="text-gray-700 mb-4">
                We retain your personal data only for as long as necessary to
                fulfill the purposes outlined in this Privacy Notice, unless a
                longer retention period is required by law:
              </Body>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>
                  <strong>Active Employee Records:</strong> During employment
                  and for a period after termination as required by law
                </li>
                <li>
                  <strong>Payroll Records:</strong> Minimum 3 years (as required
                  by BIR)
                </li>
                <li>
                  <strong>Time and Attendance Records:</strong> Minimum 3 years
                  (as required by labor laws)
                </li>
                <li>
                  <strong>Leave Records:</strong> Minimum 3 years
                </li>
              </ul>
            </section>

            {/* Data Subject Rights */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                8. Your Rights as a Data Subject
              </H2>
              <Body className="text-gray-700 mb-4">
                Under the Data Privacy Act, you have the following rights:
              </Body>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Right to be Informed
                  </H3>
                  <BodySmall className="text-gray-700">
                    Right to be informed about data collection and processing
                  </BodySmall>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Right to Access
                  </H3>
                  <BodySmall className="text-gray-700">
                    Right to access and obtain a copy of your personal data
                  </BodySmall>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Right to Object
                  </H3>
                  <BodySmall className="text-gray-700">
                    Right to object to the processing of your personal data
                  </BodySmall>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Right to Erasure
                  </H3>
                  <BodySmall className="text-gray-700">
                    Right to suspend, withdraw, or order blocking/removal of
                    your data
                  </BodySmall>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Right to Data Portability
                  </H3>
                  <BodySmall className="text-gray-700">
                    Right to obtain your data in a structured, machine-readable
                    format
                  </BodySmall>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Right to File Complaint
                  </H3>
                  <BodySmall className="text-gray-700">
                    Right to file a complaint with the National Privacy
                    Commission
                  </BodySmall>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <H3 className="font-semibold mb-2 text-blue-800">
                  How to Exercise Your Rights
                </H3>
                <BodySmall className="text-gray-700">
                  To exercise any of these rights, please contact our Data
                  Protection Officer at jericko.razal@greenpasture.ph or
                  09175257659. We will respond within 30 days as required by
                  law.
                </BodySmall>
              </div>
            </section>

            {/* Contact Information */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                9. Contact Information
              </H2>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <VStack className="gap-2">
                  <Body className="text-gray-700">
                    <strong>Data Protection Officer</strong>
                    <br />
                    Green Pasture People Management Inc.
                    <br />
                    Name: Jericko A. Razal
                    <br />
                    Position: IT Consultant
                    <br />
                    Email: jericko.razal@greenpasture.ph
                    <br />
                    Contact Number: 09175257659
                    <br />
                    Office Address: 31st Floor, Unit 3101, AIC, Burgundy Empire
                    Tower, ADB Ave, Ortigas Center, Pasig
                  </Body>
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <Body className="text-gray-700">
                      <strong>National Privacy Commission (NPC)</strong>
                      <br />
                      3rd Floor, J.P. Laurel Building
                      <br />
                      P. Paredes Street, Sampaloc, Manila
                      <br />
                      Website:{" "}
                      <a
                        href="https://privacy.gov.ph"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline"
                      >
                        https://privacy.gov.ph
                      </a>
                      <br />
                      Email: privacy@privacy.gov.ph
                      <br />
                      Hotline: (02) 8234-2228
                    </Body>
                  </div>
                </VStack>
              </div>
            </section>

            {/* Updates */}
            <section>
              <H2 className="text-xl font-semibold mb-4 text-emerald-700">
                10. Updates to This Privacy Notice
              </H2>
              <Body className="text-gray-700">
                We may update this Privacy Notice from time to time. We will
                notify you of any material changes by posting the updated notice
                on our HRIS system and displaying a notice on the login page.
                The "Last Updated" date at the top indicates when it was last
                revised.
              </Body>
            </section>

            {/* Acknowledgment */}
            <section className="p-6 bg-emerald-50 rounded-lg border-2 border-emerald-300">
              <div className="flex items-start gap-3">
                <Icon
                  name="Info"
                  size={IconSizes.md}
                  className="text-emerald-600 mt-1 flex-shrink-0"
                />
                <div>
                  <H3 className="font-semibold mb-2 text-emerald-800">
                    Acknowledgment
                  </H3>
                  <Body className="text-gray-700">
                    By using our HRIS system, you acknowledge that you have
                    read, understood, and agree to this Privacy Notice and
                    consent to the collection, processing, and use of your
                    personal data as described herein.
                  </Body>
                  <BodySmall className="text-gray-600 mt-2 italic">
                    This Privacy Notice is compliant with the Data Privacy Act
                    of 2012 (Republic Act No. 10173) and its Implementing Rules
                    and Regulations.
                  </BodySmall>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <BodySmall>
            © 2025 Green Pasture People Management Inc. All rights reserved.
          </BodySmall>
        </div>
      </div>
    </div>
  );
}
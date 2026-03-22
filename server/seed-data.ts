
  console.log("✅ Outreach status seeded");

  // Seed email activity with past dates
  await db.insert(emailActivity).values([
    {
      id: "EMAIL001",
      lawyerId: "NL004",
      caseId: "CASE001",
      emailType: "Initial",
      subject: "New Case Opportunity: Employment Law",
      sentAt: fiveDaysAgo,
      responseReceived: "Yes",
      responseStatus: "Interested",
    },
    {
      id: "EMAIL002",
      lawyerId: "NL001",
      caseId: "CASE002",
      emailType: "Initial",
      subject: "New Case Opportunity: Real Estate Law",
      sentAt: sevenDaysAgo,
      responseReceived: "Yes",
      responseStatus: "Interested",
    },
    {
      id: "EMAIL003",
      lawyerId: "NL001",
      caseId: "CASE003",
      emailType: "Initial",
      subject: "New Case Opportunity: Family Law",
      sentAt: fiveDaysAgo,
      responseReceived: "Yes",
      responseStatus: "Interested",
    },
    {
      id: "EMAIL004",
      lawyerId: "NL002",
      caseId: "CASE001",
      emailType: "Initial",
      subject: "New Case Opportunity: Employment Law",
      sentAt: fiveDaysAgo,
      responseReceived: "Yes",
      responseStatus: "Declined",
    },
  ]);

  console.log("✅ Email activity seeded");
  console.log("🎉 Database seeding completed!");
}
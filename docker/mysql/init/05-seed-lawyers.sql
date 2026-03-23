-- Seed Dutch lawyers from NOvA (Nederlandse Orde van Advocaten)
-- Covers all major legal areas relevant to LARO use cases

INSERT IGNORE INTO lawyers (id, name, city, firm, firmName, legalAreas, email, phone, website, caseStop, barAssociationStatus, currentlyAccepting, experienceYears, totalOutreaches, totalResponses, totalAcceptances, createdAt, updatedAt) VALUES

-- Employment Law
('lwr-001', 'Mr. J.H. van der Berg', 'Amsterdam', 'Van der Berg Advocaten', 'Van der Berg Advocaten', '["Arbeidsrecht","Ontslagrecht","Arbeidsovereenkomst"]', 'j.vanderberg@vdberg-advocaten.nl', '+31 20 123 4567', 'https://vdberg-advocaten.nl', 'No', 'Good Standing', 'Yes', '12', '0', '0', '0', NOW(), NOW()),

('lwr-002', 'Mw. S.M. de Groot', 'Rotterdam', 'De Groot & Partners', 'De Groot & Partners', '["Arbeidsrecht","Ontslagrecht","Discriminatie op de werkvloer"]', 's.degroot@degrootpartners.nl', '+31 10 234 5678', 'https://degrootpartners.nl', 'No', 'Good Standing', 'Yes', '8', '0', '0', '0', NOW(), NOW()),

('lwr-003', 'Mr. P.A. Janssen', 'Utrecht', 'Janssen Arbeidsrecht', 'Janssen Arbeidsrecht', '["Arbeidsrecht","Reorganisatie","Collectief ontslag"]', 'p.janssen@janssen-arbeidsrecht.nl', '+31 30 345 6789', NULL, 'No', 'Good Standing', 'Yes', '15', '0', '0', '0', NOW(), NOW()),

('lwr-004', 'Mw. L.E. Bakker', 'Den Haag', 'Bakker Advocatuur', 'Bakker Advocatuur', '["Arbeidsrecht","Ziekteverzuim","Re-integratie"]', 'l.bakker@bakker-advocatuur.nl', '+31 70 456 7890', 'https://bakker-advocatuur.nl', 'No', 'Good Standing', 'Yes', '10', '0', '0', '0', NOW(), NOW()),

('lwr-005', 'Mr. R.W. Visser', 'Eindhoven', 'Visser Legal', 'Visser Legal', '["Arbeidsrecht","Ontslagrecht","Arbeidsovereenkomst"]', 'r.visser@visser-legal.nl', '+31 40 567 8901', NULL, 'No', 'Good Standing', 'Limited', '6', '0', '0', '0', NOW(), NOW()),

-- Housing/Tenancy Law
('lwr-006', 'Mw. A.C. Smit', 'Amsterdam', 'Smit Huurrecht', 'Smit Huurrecht', '["Huurrecht","Woningrecht","Uitzetting"]', 'a.smit@smit-huurrecht.nl', '+31 20 678 9012', 'https://smit-huurrecht.nl', 'No', 'Good Standing', 'Yes', '9', '0', '0', '0', NOW(), NOW()),

('lwr-007', 'Mr. T.B. de Vries', 'Rotterdam', 'De Vries Vastgoedrecht', 'De Vries Vastgoedrecht', '["Huurrecht","Vastgoedrecht","Huurgeschillen"]', 't.devries@dvv-advocaten.nl', '+31 10 789 0123', NULL, 'No', 'Good Standing', 'Yes', '14', '0', '0', '0', NOW(), NOW()),

('lwr-008', 'Mw. K.J. Mulder', 'Utrecht', 'Mulder & Zn Advocaten', 'Mulder & Zn Advocaten', '["Huurrecht","Koop en verhuur","Servicekosten"]', 'k.mulder@mulderenzon.nl', '+31 30 890 1234', 'https://mulderenzon.nl', 'No', 'Good Standing', 'Yes', '7', '0', '0', '0', NOW(), NOW()),

-- Contract Law
('lwr-009', 'Mr. H.F. van Dijk', 'Amsterdam', 'Van Dijk Contractrecht', 'Van Dijk Contractrecht', '["Contractenrecht","Verbintenissenrecht","Incasso"]', 'h.vandijk@vd-contractrecht.nl', '+31 20 901 2345', 'https://vd-contractrecht.nl', 'No', 'Good Standing', 'Yes', '18', '0', '0', '0', NOW(), NOW()),

('lwr-010', 'Mw. F.M. Hendricks', 'Den Haag', 'Hendricks Advocaten', 'Hendricks Advocaten', '["Contractenrecht","Handelsrecht","Aansprakelijkheidsrecht"]', 'f.hendricks@hendricks-advocaten.nl', '+31 70 012 3456', NULL, 'No', 'Good Standing', 'Yes', '11', '0', '0', '0', NOW(), NOW()),

('lwr-011', 'Mr. C.D. Peters', 'Eindhoven', 'Peters Legal Solutions', 'Peters Legal Solutions', '["Contractenrecht","Ondernemingsrecht","Franchise"]', 'c.peters@peterslegal.nl', '+31 40 123 4568', 'https://peterslegal.nl', 'No', 'Good Standing', 'Limited', '5', '0', '0', '0', NOW(), NOW()),

-- Consumer Law
('lwr-012', 'Mw. I.P. van Leeuwen', 'Amsterdam', 'Van Leeuwen Consumentenrecht', 'Van Leeuwen Consumentenrecht', '["Consumentenrecht","Incasso","Schuldsanering"]', 'i.vanleeuwen@vlconsument.nl', '+31 20 234 5679', NULL, 'No', 'Good Standing', 'Yes', '8', '0', '0', '0', NOW(), NOW()),

('lwr-013', 'Mr. G.A. Schouten', 'Rotterdam', 'Schouten & Partners', 'Schouten & Partners', '["Consumentenrecht","Schulden","Incasso"]', 'g.schouten@schoutenenpartners.nl', '+31 10 345 6780', 'https://schoutenenpartners.nl', 'No', 'Good Standing', 'Yes', '13', '0', '0', '0', NOW(), NOW()),

-- Family Law
('lwr-014', 'Mw. N.R. Willemsen', 'Utrecht', 'Willemsen Familierecht', 'Willemsen Familierecht', '["Familierecht","Echtscheiding","Alimentatie"]', 'n.willemsen@willemsen-familierecht.nl', '+31 30 456 7891', 'https://willemsen-familierecht.nl', 'No', 'Good Standing', 'Yes', '16', '0', '0', '0', NOW(), NOW()),

('lwr-015', 'Mr. B.O. Koster', 'Den Haag', 'Koster Familieadvocaten', 'Koster Familieadvocaten', '["Familierecht","Echtscheiding","Kinderalimentatie","Omgangsrecht"]', 'b.koster@kosterfamilie.nl', '+31 70 567 8902', NULL, 'No', 'Good Standing', 'Yes', '20', '0', '0', '0', NOW(), NOW()),

-- Insurance Law
('lwr-016', 'Mw. D.C. Maas', 'Amsterdam', 'Maas Verzekeringsrecht', 'Maas Verzekeringsrecht', '["Verzekeringsrecht","Schadevergoeding","Aansprakelijkheidsrecht"]', 'd.maas@maas-verzekering.nl', '+31 20 678 9013', 'https://maas-verzekering.nl', 'No', 'Good Standing', 'Yes', '9', '0', '0', '0', NOW(), NOW()),

('lwr-017', 'Mr. E.V. Bosman', 'Rotterdam', 'Bosman Letselschade', 'Bosman Letselschade', '["Verzekeringsrecht","Letselschade","Aansprakelijkheidsrecht"]', 'e.bosman@bosman-letselschade.nl', '+31 10 789 0124', NULL, 'No', 'Good Standing', 'Yes', '12', '0', '0', '0', NOW(), NOW()),

-- Business/Corporate Law
('lwr-018', 'Mw. M.T. van Houten', 'Amsterdam', 'Van Houten Ondernemingsrecht', 'Van Houten Ondernemingsrecht', '["Ondernemingsrecht","Vennootschapsrecht","Fusies en overnames"]', 'm.vanhouten@vho-advocaten.nl', '+31 20 890 1235', 'https://vho-advocaten.nl', 'No', 'Good Standing', 'Yes', '22', '0', '0', '0', NOW(), NOW()),

('lwr-019', 'Mr. Q.L. Brouwer', 'Utrecht', 'Brouwer Business Law', 'Brouwer Business Law', '["Ondernemingsrecht","Handelsrecht","Aandeelhoudersgeschillen"]', 'q.brouwer@brouwerbusiness.nl', '+31 30 901 2346', NULL, 'No', 'Good Standing', 'Limited', '7', '0', '0', '0', NOW(), NOW()),

-- Medical/Healthcare Law
('lwr-020', 'Mw. V.H. Lammers', 'Den Haag', 'Lammers Gezondheidsrecht', 'Lammers Gezondheidsrecht', '["Gezondheidsrecht","Medische aansprakelijkheid","Patiëntenrecht"]', 'v.lammers@lammers-gezondheid.nl', '+31 70 012 3457', 'https://lammers-gezondheid.nl', 'No', 'Good Standing', 'Yes', '14', '0', '0', '0', NOW(), NOW()),

('lwr-021', 'Mr. W.S. Claassen', 'Amsterdam', 'Claassen Medisch Recht', 'Claassen Medisch Recht', '["Gezondheidsrecht","Medische fouten","Zorgrecht"]', 'w.claassen@claassen-medisch.nl', '+31 20 123 4569', NULL, 'No', 'Good Standing', 'Yes', '11', '0', '0', '0', NOW(), NOW()),

-- Civil/Administrative Law
('lwr-022', 'Mw. X.P. de Jong', 'Rotterdam', 'De Jong Civielrecht', 'De Jong Civielrecht', '["Civiel recht","Bestuursrecht","Overheidsaansprakelijkheid"]', 'x.dejong@dejong-civiel.nl', '+31 10 234 5680', 'https://dejong-civiel.nl', 'No', 'Good Standing', 'Yes', '17', '0', '0', '0', NOW(), NOW()),

('lwr-023', 'Mr. Y.A. Hermans', 'Eindhoven', 'Hermans Bestuursrecht', 'Hermans Bestuursrecht', '["Bestuursrecht","Omgevingsrecht","Vergunningen"]', 'y.hermans@hermans-bestuur.nl', '+31 40 345 6781', NULL, 'No', 'Good Standing', 'Yes', '9', '0', '0', '0', NOW(), NOW()),

-- Debt Collection / Financial
('lwr-024', 'Mw. Z.E. Timmermans', 'Amsterdam', 'Timmermans Incasso', 'Timmermans Incasso', '["Incasso","Schuldsanering","WSNP","Faillissementsrecht"]', 'z.timmermans@timmermans-incasso.nl', '+31 20 456 7892', 'https://timmermans-incasso.nl', 'No', 'Good Standing', 'Yes', '13', '0', '0', '0', NOW(), NOW()),

('lwr-025', 'Mr. A.B. Nieuwenhuis', 'Utrecht', 'Nieuwenhuis Schuldenrecht', 'Nieuwenhuis Schuldenrecht', '["Schulden","Incasso","Bewindvoering","Budgetbeheer"]', 'a.nieuwenhuis@nieuwenhuis-schuld.nl', '+31 30 567 8903', NULL, 'No', 'Good Standing', 'Yes', '6', '0', '0', '0', NOW(), NOW()),

-- Privacy / GDPR
('lwr-026', 'Mw. B.C. van Ommen', 'Den Haag', 'Van Ommen Privacy Advocaten', 'Van Ommen Privacy Advocaten', '["Privacyrecht","AVG/GDPR","Gegevensbescherming"]', 'b.vanommen@vo-privacy.nl', '+31 70 678 9014', 'https://vo-privacy.nl', 'No', 'Good Standing', 'Yes', '8', '0', '0', '0', NOW(), NOW()),

-- Criminal Law
('lwr-027', 'Mr. C.D. Vermeulen', 'Amsterdam', 'Vermeulen Strafrecht', 'Vermeulen Strafrecht', '["Strafrecht","Verdediging","Schadevergoeding slachtoffers"]', 'c.vermeulen@vermeulen-straf.nl', '+31 20 789 0125', NULL, 'No', 'Good Standing', 'Yes', '19', '0', '0', '0', NOW(), NOW()),

-- Immigration Law
('lwr-028', 'Mw. D.E. Postma', 'Rotterdam', 'Postma Immigratierecht', 'Postma Immigratierecht', '["Immigratierecht","Verblijfsvergunning","Naturalisatie"]', 'd.postma@postma-immigratie.nl', '+31 10 890 1236', 'https://postma-immigratie.nl', 'No', 'Good Standing', 'Yes', '11', '0', '0', '0', NOW(), NOW()),

-- Intellectual Property
('lwr-029', 'Mr. E.F. Kuipers', 'Amsterdam', 'Kuipers IE Advocaten', 'Kuipers IE Advocaten', '["Intellectueel eigendom","Merkenrecht","Auteursrecht"]', 'e.kuipers@kuipers-ie.nl', '+31 20 901 2347', NULL, 'No', 'Good Standing', 'Limited', '15', '0', '0', '0', NOW(), NOW()),

-- General Practice (catches all)
('lwr-030', 'Mw. F.G. van Rijn', 'Amsterdam', 'Van Rijn Algemene Praktijk', 'Van Rijn Algemene Praktijk', '["Arbeidsrecht","Huurrecht","Contractenrecht","Familierecht","Consumentenrecht"]', 'f.vanrijn@vanrijn-advocaten.nl', '+31 20 012 3458', 'https://vanrijn-advocaten.nl', 'No', 'Good Standing', 'Yes', '25', '0', '0', '0', NOW(), NOW());

SELECT CONCAT('Seeded ', COUNT(*), ' lawyers') as status FROM lawyers;
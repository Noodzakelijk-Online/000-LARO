import unittest
import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from ucid_service import UCIDService
from app import app, db

class TestUCIDSystem(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test."""
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:' # Use in-memory SQLite for tests
        self.app_context = app.app_context()
        self.app_context.push()
        db.create_all()
        self.ucid_service = UCIDService(db.session)

    def tearDown(self):
        """Clean up test environment after each test."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_generate_ucid(self):
        """Test automatic UCID generation."""
        print("\nRunning test_01_generate_ucid...")
        ucid = self.ucid_service.generate_ucid()
        self.assertIsNotNone(ucid)
        self.assertIsInstance(ucid, str)
        self.assertTrue(len(ucid) > 10) # Basic check for UUID-like string
        print(f"Generated UCID: {ucid}")
        print("test_01_generate_ucid: PASSED")

    def test_02_create_case_with_ucid(self):
        """Test creating a new case, which should assign a UCID."""
        print("\nRunning test_02_create_case_with_ucid...")
        case_details = {"name": "Test Case 1", "description": "A case for testing UCID generation"}
        created_case = self.ucid_service.create_case(case_details)
        self.assertIsNotNone(created_case)
        self.assertIsNotNone(created_case.ucid)
        self.assertEqual(created_case.name, "Test Case 1")
        print(f"Created case with UCID: {created_case.ucid}, Name: {created_case.name}")
        print("test_02_create_case_with_ucid: PASSED")
        return created_case.ucid

    def test_03_link_sub_case_id(self):
        """Test linking a sub-case ID to an existing UCID."""
        print("\nRunning test_03_link_sub_case_id...")
        # First, create a case to get a UCID
        case_details = {"name": "Case for Sub ID Linking", "description": "Testing sub_id linking"}
        created_case = self.ucid_service.create_case(case_details)
        ucid = created_case.ucid
        self.assertIsNotNone(ucid)

        sub_id_details = {"sub_id_value": "COURT-XYZ-123", "source_party": "District Court"}
        linked_sub_id = self.ucid_service.link_sub_case_id(ucid, sub_id_details)
        self.assertIsNotNone(linked_sub_id)
        self.assertEqual(linked_sub_id.sub_id_value, "COURT-XYZ-123")
        self.assertEqual(linked_sub_id.source_party, "District Court")
        self.assertEqual(linked_sub_id.ucid_id, ucid)
        print(f"Linked Sub-ID: {linked_sub_id.sub_id_value} from {linked_sub_id.source_party} to UCID: {ucid}")

        # Test linking another sub-ID to the same UCID
        sub_id_details_2 = {"sub_id_value": "POLICE-REF-007", "source_party": "Local Police Dept"}
        linked_sub_id_2 = self.ucid_service.link_sub_case_id(ucid, sub_id_details_2)
        self.assertIsNotNone(linked_sub_id_2)
        self.assertEqual(linked_sub_id_2.sub_id_value, "POLICE-REF-007")
        print(f"Linked another Sub-ID: {linked_sub_id_2.sub_id_value} to UCID: {ucid}")
        print("test_03_link_sub_case_id: PASSED")

    def test_04_get_case_by_ucid(self):
        """Test retrieving a case by its UCID."""
        print("\nRunning test_04_get_case_by_ucid...")
        case_details = {"name": "Searchable Case by UCID", "description": "Testing UCID search"}
        created_case = self.ucid_service.create_case(case_details)
        ucid_to_search = created_case.ucid

        found_case = self.ucid_service.get_case_by_ucid(ucid_to_search)
        self.assertIsNotNone(found_case)
        self.assertEqual(found_case.ucid, ucid_to_search)
        self.assertEqual(found_case.name, "Searchable Case by UCID")
        print(f"Found case by UCID {ucid_to_search}: {found_case.name}")
        print("test_04_get_case_by_ucid: PASSED")

    def test_05_get_cases_by_sub_id(self):
        """Test retrieving cases by a sub-case ID."""
        print("\nRunning test_05_get_cases_by_sub_id...")
        # Create a case and link a sub-ID
        case_details = {"name": "Case for Sub ID Search", "description": "Testing sub_id search"}
        created_case = self.ucid_service.create_case(case_details)
        ucid = created_case.ucid
        sub_id_value_to_search = "UNIQUE-SUB-ID-789"
        sub_id_details = {"sub_id_value": sub_id_value_to_search, "source_party": "Testing Agency"}
        self.ucid_service.link_sub_case_id(ucid, sub_id_details)

        found_cases = self.ucid_service.get_cases_by_sub_id(sub_id_value_to_search)
        self.assertIsNotNone(found_cases)
        self.assertGreater(len(found_cases), 0)
        self.assertEqual(found_cases[0].ucid, ucid)
        self.assertEqual(found_cases[0].name, "Case for Sub ID Search")
        print(f"Found case(s) by Sub-ID {sub_id_value_to_search}: {[case.name for case in found_cases]}")
        print("test_05_get_cases_by_sub_id: PASSED")

    def test_06_get_sub_ids_for_ucid(self):
        """Test retrieving all sub-case IDs linked to a UCID."""
        print("\nRunning test_06_get_sub_ids_for_ucid...")
        case_details = {"name": "Case with Multiple Sub IDs", "description": "Testing retrieval of all sub_ids"}
        created_case = self.ucid_service.create_case(case_details)
        ucid = created_case.ucid

        sub_id1_details = {"sub_id_value": "MULTI-SUB-001", "source_party": "Party A"}
        sub_id2_details = {"sub_id_value": "MULTI-SUB-002", "source_party": "Party B"}
        self.ucid_service.link_sub_case_id(ucid, sub_id1_details)
        self.ucid_service.link_sub_case_id(ucid, sub_id2_details)

        sub_ids = self.ucid_service.get_sub_ids_for_ucid(ucid)
        self.assertIsNotNone(sub_ids)
        self.assertEqual(len(sub_ids), 2)
        sub_id_values = [s.sub_id_value for s in sub_ids]
        self.assertIn("MULTI-SUB-001", sub_id_values)
        self.assertIn("MULTI-SUB-002", sub_id_values)
        print(f"Sub-IDs for UCID {ucid}: {[(s.sub_id_value, s.source_party) for s in sub_ids]}")
        print("test_06_get_sub_ids_for_ucid: PASSED")

    def test_07_find_or_create_case_retroactive_new(self):
        """Test retroactive case creation when no existing UCID/SubID is found."""
        print("\nRunning test_07_find_or_create_case_retroactive_new...")
        document_identifiers = [("DOC-REF-A1", "Client Docs"), ("GOV-REF-B2", "Gov Portal")]
        case_details = {"name": "Retro Case New", "description": "From document processing"}
        
        # Simulate finding no existing case by these identifiers
        # For this test, we assume find_case_by_identifiers would return None
        # So we directly call create_case_with_sub_ids

        created_case, linked_sub_ids = self.ucid_service.find_or_create_case_with_sub_ids(case_details, document_identifiers)
        
        self.assertIsNotNone(created_case)
        self.assertIsNotNone(created_case.ucid)
        self.assertEqual(created_case.name, "Retro Case New")
        self.assertEqual(len(linked_sub_ids), 2)
        self.assertIn("DOC-REF-A1", [sid.sub_id_value for sid in linked_sub_ids])
        self.assertIn("GOV-REF-B2", [sid.sub_id_value for sid in linked_sub_ids])
        print(f"Retroactively created new case with UCID: {created_case.ucid} and linked {len(linked_sub_ids)} sub-IDs.")
        print("test_07_find_or_create_case_retroactive_new: PASSED")

    def test_08_find_or_create_case_retroactive_existing_by_sub_id(self):
        """Test retroactive case finding when an existing SubID is found."""
        print("\nRunning test_08_find_or_create_case_retroactive_existing_by_sub_id...")
        # 1. Create an initial case and link a sub-ID
        initial_case_details = {"name": "Original Retro Case", "description": "To be found later"}
        initial_sub_id_val = "EXISTING-SUB-ID-RETRO"
        initial_sub_id_source = "Original Source"
        
        created_case, linked_sub_ids_initial = self.ucid_service.find_or_create_case_with_sub_ids(
            initial_case_details, 
            [(initial_sub_id_val, initial_sub_id_source)]
        )
        original_ucid = created_case.ucid

        # 2. Simulate processing new documents that contain the same sub-ID
        # and potentially a new one for the same case
        document_identifiers_for_find = [
            (initial_sub_id_val, initial_sub_id_source), # Existing sub-ID
            ("NEW-SUB-ID-FOR-RETRO", "New Source") # New sub-ID for the same case
        ]
        new_case_details_if_needed = {"name": "This should not be used", "description": "Should find existing"}

        found_or_created_case, linked_sub_ids_found = self.ucid_service.find_or_create_case_with_sub_ids(
            new_case_details_if_needed, 
            document_identifiers_for_find
        )

        self.assertIsNotNone(found_or_created_case)
        self.assertEqual(found_or_created_case.ucid, original_ucid) # Should be the same UCID
        self.assertEqual(found_or_created_case.name, "Original Retro Case") # Name should be from original case
        
        # Check that all sub-IDs are now linked (original + new one)
        all_sub_ids_for_case = self.ucid_service.get_sub_ids_for_ucid(original_ucid)
        self.assertEqual(len(all_sub_ids_for_case), 2) # Initial one + the new one
        sub_id_values = [s.sub_id_value for s in all_sub_ids_for_case]
        self.assertIn(initial_sub_id_val, sub_id_values)
        self.assertIn("NEW-SUB-ID-FOR-RETRO", sub_id_values)
        
        print(f"Retroactively found existing case with UCID: {found_or_created_case.ucid} by sub-ID '{initial_sub_id_val}'.")
        print(f"All linked sub-IDs for {original_ucid}: {[(s.sub_id_value, s.source_party) for s in all_sub_ids_for_case]}")
        print("test_08_find_or_create_case_retroactive_existing_by_sub_id: PASSED")

    def test_09_link_sub_case_id_to_nonexistent_ucid(self):
        """Test linking a sub-case ID to a non-existent UCID."""
        print("\nRunning test_09_link_sub_case_id_to_nonexistent_ucid...")
        non_existent_ucid = self.ucid_service.generate_ucid() # Generate one, but don't create a case for it
        sub_id_details = {"sub_id_value": "ORPHAN-SUB-ID", "source_party": "Ghost Party"}
        with self.assertRaises(ValueError) as context:
            self.ucid_service.link_sub_case_id(non_existent_ucid, sub_id_details)
        self.assertTrue(f"Case with UCID {non_existent_ucid} not found" in str(context.exception))
        print(f"Correctly raised ValueError for non-existent UCID: {non_existent_ucid}")
        print("test_09_link_sub_case_id_to_nonexistent_ucid: PASSED")

    def test_10_get_case_by_nonexistent_ucid(self):
        """Test retrieving a case by a non-existent UCID."""
        print("\nRunning test_10_get_case_by_nonexistent_ucid...")
        non_existent_ucid = self.ucid_service.generate_ucid()
        found_case = self.ucid_service.get_case_by_ucid(non_existent_ucid)
        self.assertIsNone(found_case)
        print(f"Correctly returned None for non-existent UCID: {non_existent_ucid}")
        print("test_10_get_case_by_nonexistent_ucid: PASSED")

    def test_11_get_cases_by_nonexistent_sub_id(self):
        """Test retrieving cases by a non-existent sub-case ID."""
        print("\nRunning test_11_get_cases_by_nonexistent_sub_id...")
        non_existent_sub_id = "NON-EXISTENT-SUB-ID-12345"
        found_cases = self.ucid_service.get_cases_by_sub_id(non_existent_sub_id)
        self.assertEqual(len(found_cases), 0)
        print(f"Correctly returned empty list for non-existent Sub-ID: {non_existent_sub_id}")
        print("test_11_get_cases_by_nonexistent_sub_id: PASSED")

if __name__ == '__main__':
    # Create a dummy app.py and ucid_service.py if they don't exist, for linting/static analysis
    # In actual execution, these would be the real files from the project.
    # This is primarily for making the standalone script runnable for testing its own logic structure.
    if not os.path.exists("app.py"):
        with open("app.py", "w") as f:
            f.write("from flask import Flask\n")
            f.write("from flask_sqlalchemy import SQLAlchemy\n")
            f.write("app = Flask(__name__)\n")
            f.write("app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'\n")
            f.write("app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False\n")
            f.write("db = SQLAlchemy(app)\n")

    if not os.path.exists("ucid_service.py"):
        with open("ucid_service.py", "w") as f:
            f.write("# Dummy ucid_service.py for testing structure\n")
            f.write("class UCIDService:\n")
            f.write("    def __init__(self, session):\n")
            f.write("        self.session = session\n")
            f.write("    def generate_ucid(self): return 'dummy-ucid'\n")
            f.write("    def create_case(self, details): return type('Case', (), {'ucid': 'dummy-ucid', 'name': details.get('name')})()\n")
            f.write("    def link_sub_case_id(self, ucid, details): return type('SubCaseID', (), {'sub_id_value': details.get('sub_id_value'), 'source_party': details.get('source_party'), 'ucid_id': ucid})()\n")
            f.write("    def get_case_by_ucid(self, ucid): return None\n")
            f.write("    def get_cases_by_sub_id(self, sub_id): return []\n")
            f.write("    def get_sub_ids_for_ucid(self, ucid): return []\n")
            f.write("    def find_or_create_case_with_sub_ids(self, case_details, sub_id_tuples): return (self.create_case(case_details), [])\n")

    print("Starting UCID System Tests...")
    # Create a TestLoader
    loader = unittest.TestLoader()
    # Create a TestSuite
    suite = unittest.TestSuite()
    # Add tests to the suite: loader.loadTestsFromTestCase(TestUCIDSystem) ensures order
    suite.addTests(loader.loadTestsFromTestCase(TestUCIDSystem))
    # Create a TestResult object
    result = unittest.TestResult()
    # Run the tests
    suite.run(result)

    print("\n--- Test Summary ---")
    print(f"Tests Run: {result.testsRun}")
    print(f"Errors: {len(result.errors)}")
    for test, err in result.errors:
        print(f"  ERROR in {test}: {err}")
    print(f"Failures: {len(result.failures)}")
    for test, fail in result.failures:
        print(f"  FAILURE in {test}: {fail}")
    
    if result.wasSuccessful():
        print("\nAll UCID system tests PASSED!")
    else:
        print("\nSome UCID system tests FAILED.")


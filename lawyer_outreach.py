# Automated Lawyer Outreach System for Legal AI Platform

import datetime
import json
import time
import random
import smtplib
import email.utils
import re # Import regex for parsing follow-up count
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from typing import List, Dict, Any, Optional, Tuple

class LawyerOutreachSystem:
    """
    System for automating email outreach to legal professionals in the Netherlands.
    Features include:
    - Comprehensive outreach based on legal field expertise to all relevant active lawyers.
    - Automated pre-assessment request (Willing, Able, Ready).
    - Robust automated follow-up scheduling and sending (configurable).
    - Response tracking and categorization.
    - Performance analytics.
    """

    def __init__(self, case_id: int, user_id: int, max_follow_ups: int = 2, follow_up_interval_days: int = 3):
        """Initialize the outreach system for a specific case."""
        self.case_id = case_id
        self.user_id = user_id
        self.outreach_records = [] # Stores records of emails sent
        self.responses = [] # Stores categorized responses received
        self.follow_ups_sent_count = 0 # Total follow-ups sent in this campaign
        self.start_time = datetime.datetime.now()
        self.max_follow_ups = max_follow_ups # Max follow-ups per lawyer
        self.follow_up_interval_days = follow_up_interval_days # Days between follow-ups

    def load_lawyer_database(self, legal_field: str = None) -> List[Dict[str, Any]]:
        """
        Load *all active* lawyers from the database, optionally filtered by legal field.
        (Simulated data)
        """
        legal_fields = [
            'family_law', 'criminal_law', 'corporate_law', 'employment_law',
            'real_estate_law', 'immigration_law', 'intellectual_property_law', 'tax_law'
        ]
        cities = [
            'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven',
            'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen'
        ]
        sample_lawyers = []
        # Simulate a larger pool to ensure enough match the field
        for i in range(1, 201):
            lawyer_fields = random.sample(legal_fields, random.randint(1, 3))
            is_active = random.random() > 0.1 # Simulate 90% active

            # Only include active lawyers matching the field (if specified)
            if is_active and (not legal_field or legal_field in lawyer_fields):
                lawyer = {
                    'lawyer_id': i,
                    'nova_id': f"NOVA{100000 + i}",
                    'email': f"lawyer{i}@example.com",
                    'first_name': f"FirstName{i}",
                    'last_name': f"LastName{i}",
                    'phone': f"+31 6 {random.randint(10000000, 99999999)}",
                    'firm_name': f"Law Firm {i // 10 + 1}",
                    'city': random.choice(cities),
                    'legal_fields': lawyer_fields,
                    'response_rate': random.uniform(0.1, 0.6), # Still useful for analytics
                    'acceptance_rate': random.uniform(0.01, 0.1),
                    'is_active': is_active
                }
                sample_lawyers.append(lawyer)

        if legal_field:
            print(f"Loaded {len(sample_lawyers)} active lawyers specializing in {legal_field}")
        else:
            print(f"Loaded {len(sample_lawyers)} active lawyers from all fields")
        return sample_lawyers

    def prepare_email_content(self, lawyer: Dict[str, Any], case_summary: str,
                             is_follow_up: bool = False, follow_up_number: int = 0) -> Dict[str, str]:
        """
        Prepare personalized email content, including pre-assessment request.
        follow_up_number is 1-based (1st follow-up, 2nd follow-up etc.)
        """
        current_date = datetime.datetime.now().strftime("%d %B %Y")
        legal_fields_str = ', '.join(lawyer['legal_fields'])

        if not is_follow_up:
            # Initial outreach with Pre-Assessment Request
            subject = f"Case Inquiry & Availability Check: Representation in {legal_fields_str}"
            body = f"""
Dear {lawyer['first_name']} {lawyer['last_name']},

I hope this email finds you well. Our AI-driven Legal Outreach Platform is contacting you on behalf of a potential client seeking representation in {legal_fields_str}.

**Case Summary:**
{case_summary}

Based on your expertise (registered with NOvA), we believe you may be suitable for this case.

**Pre-Assessment Request:**
To streamline the process for the client, could you please briefly indicate your status regarding this potential case by replying with ONE of the following options?

1.  **INTERESTED**: You are potentially willing, able (expertise matches), and have the capacity to consider this case further.
2.  **MORE INFO**: You need more details before deciding.
3.  **UNAVAILABLE**: You are unable to take this case at this time (due to capacity, conflict, or other reasons).

If you reply with "INTERESTED", we will promptly provide the full case details for your review.

Thank you for your time and consideration. We look forward to your response.

Best regards,
Legal AI Reach Out Platform
On behalf of the client
{current_date}
            """
        else:
            # Follow-up email
            follow_up_phrases = [
                "I wanted to follow up on my previous email",
                "I am writing to follow up on the legal case inquiry and availability check I sent recently",
                "I'm checking in regarding the representation request and availability check I sent earlier"
            ]
            urgency_phrases = [
                "The client is eager to secure representation soon.",
                "The client would appreciate a timely response as they need to proceed with their case.",
                "As time is of the essence for this matter, a prompt response would be greatly appreciated."
            ]
            subject = f"Follow-up ({follow_up_number}/{self.max_follow_ups}): Case Inquiry & Availability Check"
            body = f"""
Dear {lawyer['first_name']} {lawyer['last_name']},

{random.choice(follow_up_phrases)} regarding a client seeking representation in {legal_fields_str}.

**Case Summary Recap:**
{case_summary}

We kindly request a brief response indicating if you are INTERESTED, need MORE INFO, or are UNAVAILABLE for this potential case, as outlined in the previous email.

{random.choice(urgency_phrases)}

Thank you for your time and consideration.

Best regards,
Legal AI Reach Out Platform
On behalf of the client
{current_date}
            """

        return {
            'subject': subject,
            'body': body.strip()
        }

    def send_email(self, lawyer: Dict[str, Any], email_content: Dict[str, str],
                  attachments: List[str] = None, existing_record: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Send an email to a lawyer (Simulated). If existing_record is provided, updates it (for follow-ups).
        """
        timestamp = datetime.datetime.now()
        is_follow_up = 'Follow-up' in email_content['subject']
        follow_up_number = 0
        if is_follow_up:
            match = re.search(r'Follow-up (\d+)', email_content['subject'])
            if match:
                follow_up_number = int(match.group(1))

        if existing_record:
            # Update existing record for follow-up
            existing_record['subject'] = email_content['subject']
            existing_record['is_follow_up'] = True
            existing_record['follow_up_number'] = follow_up_number
            existing_record['sent_timestamp'] = timestamp.isoformat() # Update sent time
            existing_record['status'] = 'follow_up_sent'
            print(f"Follow-up {follow_up_number} sent to {lawyer['email']} with subject: {email_content['subject']}")
            self.follow_ups_sent_count += 1
            return existing_record
        else:
            # Create new record for initial outreach
            outreach_id = len(self.outreach_records) + 1
            outreach_record = {
                'outreach_id': outreach_id,
                'case_id': self.case_id,
                'lawyer_id': lawyer['lawyer_id'],
                'lawyer_name': f"{lawyer['first_name']} {lawyer['last_name']}",
                'lawyer_email': lawyer['email'],
                'subject': email_content['subject'],
                'is_follow_up': False,
                'follow_up_number': 0,
                'sent_timestamp': timestamp.isoformat(),
                'has_attachments': bool(attachments),
                'status': 'sent', # Initial status
                'response_received': False,
                'response_timestamp': None,
                'response_type': None # e.g., 'pre_assessment_positive', 'pre_assessment_negative', 'more_info', 'no_response'
            }
            self.outreach_records.append(outreach_record)
            print(f"Initial email sent to {lawyer['email']} with subject: {email_content['subject']}")
            return outreach_record

    def send_initial_outreach(self, case_summary: str, legal_field: str) -> List[Dict[str, Any]]:
        """
        Send initial outreach emails with pre-assessment request to ALL relevant active lawyers.
        """
        target_lawyers = self.load_lawyer_database(legal_field)
        # No sorting or limiting needed here - reach out to all relevant active lawyers
        
        initial_outreach_records = []
        for lawyer in target_lawyers:
            email_content = self.prepare_email_content(lawyer, case_summary)
            outreach_record = self.send_email(lawyer, email_content)
            initial_outreach_records.append(outreach_record)
            time.sleep(0.02) # Small delay for simulation
            
        print(f"Sent initial outreach with pre-assessment request to {len(initial_outreach_records)} lawyers specializing in {legal_field}")
        return initial_outreach_records

    def check_for_responses(self) -> List[Dict[str, Any]]:
        """
        Check for responses and categorize them based on pre-assessment keywords (Simulated).
        """
        new_responses = []
        for record in self.outreach_records:
            # Only check if no response has been received yet
            if not record['response_received']:
                # Simulate a chance of receiving a response
                # Higher chance for initial email, lower for follow-ups
                response_chance = 0.3 if not record['is_follow_up'] else 0.15 * (0.8 ** record['follow_up_number'])
                if random.random() < response_chance:
                    timestamp = datetime.datetime.now()

                    # Simulate response content and determine type
                    response_type_rand = random.random()
                    simulated_reply_body = ""
                    if response_type_rand < 0.2: # 20% positive pre-assessment
                        response_type = 'pre_assessment_positive'
                        simulated_reply_body = random.choice(["INTERESTED", "Yes, interested.", "Send more details, I'm interested."])
                    elif response_type_rand < 0.5: # 30% request more info
                        response_type = 'more_info'
                        simulated_reply_body = random.choice(["MORE INFO", "Need more details.", "Can you provide the full file?"])
                    else: # 50% unavailable/negative
                        response_type = 'pre_assessment_negative'
                        simulated_reply_body = random.choice(["UNAVAILABLE", "Not taking new cases.", "Conflict of interest.", "Not my area."])

                    # Update the outreach record
                    record['response_received'] = True
                    record['response_timestamp'] = timestamp.isoformat()
                    record['response_type'] = response_type
                    record['status'] = 'responded'

                    # Create a response record
                    response = {
                        'response_id': len(self.responses) + 1,
                        'outreach_id': record['outreach_id'],
                        'lawyer_id': record['lawyer_id'],
                        'lawyer_name': record['lawyer_name'],
                        'lawyer_email': record['lawyer_email'],
                        'timestamp': timestamp.isoformat(),
                        'response_type': response_type,
                        'content': simulated_reply_body
                    }
                    self.responses.append(response)
                    new_responses.append(response)

        if new_responses:
            print(f"Received and categorized {len(new_responses)} new responses")
        return new_responses

    def schedule_follow_ups(self) -> List[Dict[str, Any]]:
        """
        Identify outreach records needing a follow-up based on interval and max attempts.
        """
        follow_up_needed = []
        current_time = datetime.datetime.now()
        for record in self.outreach_records:
            # Check if no response AND max follow-ups not reached
            if not record['response_received'] and record['follow_up_number'] < self.max_follow_ups:
                sent_time = datetime.datetime.fromisoformat(record['sent_timestamp'])
                days_elapsed = (current_time - sent_time).days
                # Check if interval has passed since last sent email (initial or follow-up)
                if days_elapsed >= self.follow_up_interval_days:
                    follow_up_needed.append(record)
        if follow_up_needed:
             print(f"Identified {len(follow_up_needed)} outreach records needing follow-up")
        return follow_up_needed

    def send_scheduled_follow_ups(self, case_summary: str) -> List[Dict[str, Any]]:
        """
        Send follow-up emails for outreach identified by schedule_follow_ups.
        """
        follow_up_needed = self.schedule_follow_ups()
        sent_follow_up_records = []
        if not follow_up_needed:
             print("No follow-ups needed at this time.")
             return []

        # Load lawyer details efficiently
        lawyers_db = self.load_lawyer_database() # Load all active lawyers
        lawyer_map = {l['lawyer_id']: l for l in lawyers_db}

        for record in follow_up_needed:
            lawyer = lawyer_map.get(record['lawyer_id'])
            if lawyer:
                # Determine the correct follow-up number (1-based)
                next_follow_up_number = record['follow_up_number'] + 1
                email_content = self.prepare_email_content(
                    lawyer, case_summary, is_follow_up=True, follow_up_number=next_follow_up_number
                )
                # Send email and update the *same* record
                updated_record = self.send_email(lawyer, email_content, existing_record=record)
                sent_follow_up_records.append(updated_record)
                time.sleep(0.02) # Small delay
            else:
                print(f"Warning: Could not find lawyer details for ID {record['lawyer_id']} to send follow-up.")

        if sent_follow_up_records:
            print(f"Sent {len(sent_follow_up_records)} follow-up emails")
        return sent_follow_up_records

    def get_interested_lawyers(self) -> List[Dict[str, Any]]:
        """
        Get lawyers who responded positively to the pre-assessment ('INTERESTED').
        This is the primary list shown to the user.

        Returns:
            List of lawyer dictionaries who are interested.
        """
        # Filter responses for only positive pre-assessment
        interested_responses = [r for r in self.responses if r['response_type'] == 'pre_assessment_positive']
        interested_lawyer_ids = set(r['lawyer_id'] for r in interested_responses)

        if not interested_lawyer_ids:
            print("No lawyers responded as 'INTERESTED' yet.")
            return []

        # Load full lawyer details for interested ones
        lawyers_db = self.load_lawyer_database() # Load all active lawyers
        interested_lawyers = [l for l in lawyers_db if l['lawyer_id'] in interested_lawyer_ids]

        print(f"Found {len(interested_lawyers)} lawyers who responded 'INTERESTED'")
        return interested_lawyers

    def get_outreach_statistics(self) -> Dict[str, Any]:
        """
        Calculate statistics for the outreach campaign.
        """
        total_outreach_attempts = len(self.outreach_records) # Includes initial + follow-ups
        unique_lawyers_contacted = len(set(r['lawyer_id'] for r in self.outreach_records))
        responses_received = len(self.responses)
        
        # Calculate response rate based on unique lawyers contacted
        response_rate_unique = responses_received / unique_lawyers_contacted if unique_lawyers_contacted > 0 else 0

        interested_lawyers_count = len([r for r in self.responses if r['response_type'] == 'pre_assessment_positive'])
        # Calculate interest rate based on unique lawyers contacted
        interest_rate_overall = interested_lawyers_count / unique_lawyers_contacted if unique_lawyers_contacted > 0 else 0

        more_info_requests = len([r for r in self.responses if r['response_type'] == 'more_info'])
        unavailable_responses = len([r for r in self.responses if r['response_type'] == 'pre_assessment_negative'])

        # Lawyers who never responded after all follow-ups
        no_response_count = 0
        for record in self.outreach_records:
            # Check if it's the last attempt for this lawyer and no response
            is_last_attempt = record['follow_up_number'] == self.max_follow_ups
            if is_last_attempt and not record['response_received']:
                 # Need to ensure we count unique lawyers only once for no-response
                 # This simple count might overcount if multiple records exist per lawyer (shouldn't happen with current logic)
                 no_response_count +=1 
                 # A more robust way would be to check all records for a lawyer_id

        elapsed_time_hours = (datetime.datetime.now() - self.start_time).total_seconds() / 3600

        stats = {
            'total_outreach_emails_sent': total_outreach_attempts,
            'unique_lawyers_contacted': unique_lawyers_contacted,
            'responses_received': responses_received,
            'response_rate_unique_lawyers': f"{response_rate_unique:.1%}",
            'interested_lawyers_count': interested_lawyers_count,
            'interest_rate_overall': f"{interest_rate_overall:.1%}",
            'more_info_requests': more_info_requests,
            'unavailable_responses': unavailable_responses,
            'follow_ups_sent_total': self.follow_ups_sent_count,
            # 'no_response_after_followups': no_response_count, # Calculation needs refinement
            'elapsed_time_hours': round(elapsed_time_hours, 2)
        }
        return stats

# Example Usage (Updated)
if __name__ == '__main__':
    case_id = 102
    user_id = 56
    legal_field_needed = 'employment_law'
    summary = "Client seeking advice on non-compete clause validity after recent job change. Needs urgent review."

    # Initialize with custom follow-up settings
    outreach_system = LawyerOutreachSystem(case_id, user_id, max_follow_ups=3, follow_up_interval_days=2)

    # Send initial outreach to ALL relevant active lawyers
    outreach_system.send_initial_outreach(summary, legal_field_needed)
    print("--- Initial outreach sent ---")

    # Simulate time passing and check for responses
    print("\n--- Simulating 1 day passing ---")
    time.sleep(1)
    outreach_system.check_for_responses()

    print("\n--- Simulating 2 more days passing (total 3 days) ---")
    time.sleep(2)
    outreach_system.check_for_responses() # Check again
    outreach_system.send_scheduled_follow_ups(summary) # Send 1st follow-up if needed

    print("\n--- Simulating 2 more days passing (total 5 days) ---")
    time.sleep(2)
    outreach_system.check_for_responses()
    outreach_system.send_scheduled_follow_ups(summary) # Send 2nd follow-up if needed

    print("\n--- Simulating 2 more days passing (total 7 days) ---")
    time.sleep(2)
    outreach_system.check_for_responses()
    outreach_system.send_scheduled_follow_ups(summary) # Send 3rd follow-up if needed (max=3)
    
    print("\n--- Simulating 2 more days passing (total 9 days) ---")
    time.sleep(2)
    outreach_system.check_for_responses()
    outreach_system.send_scheduled_follow_ups(summary) # Should send no more follow-ups

    print("\n--- Final Results ---")
    interested = outreach_system.get_interested_lawyers()
    print(f"\nInterested Lawyers Presented to User ({len(interested)}):")
    for lawyer in interested:
        print(f"- {lawyer['first_name']} {lawyer['last_name']} ({lawyer['email']})")

    print("\nOutreach Statistics:")
    stats = outreach_system.get_outreach_statistics()
    print(json.dumps(stats, indent=2))


## Form Validation

The Legal AI Reach Out platform implements comprehensive client-side form validation using JavaScript (`frontend/js/form-validation.js`) to ensure data integrity, improve user experience by providing immediate feedback, and reduce unnecessary server load. Backend validation is also performed as a crucial second layer of defense.

### 1. Real-time Validation Feedback

-   **Event Listeners**: Validation typically occurs on `blur` (when a user leaves a field) and `submit` events for forms.
-   **Visual Cues**: Invalid fields are visually highlighted (e.g., red border, error icon). Corresponding error messages are displayed near the respective fields, providing clear guidance on how to correct the input.
-   **Success Cues**: Valid fields might receive a success cue (e.g., green border, checkmark icon) to confirm correct input.

### 2. Common Validation Rules Implemented

-   **Required Fields**: Ensures that mandatory fields (e.g., username, password, email, case description) are not left empty. An error message like "This field is required" is shown.
-   **Email Format**: Validates that email inputs match a standard email pattern (e.g., `user@example.com`) using regular expressions. Error: "Please enter a valid email address."
-   **Password Strength & Confirmation**:
    -   **Strength**: As detailed in Security Enhancements, password fields are validated for minimum length, and inclusion of uppercase, lowercase, numbers, and special characters. Feedback is provided via a strength meter and specific error messages (e.g., "Password must be at least 8 characters long").
    -   **Confirmation**: For registration or password change forms, the "confirm password" field must match the "password" field. Error: "Passwords do not match."
-   **Minimum/Maximum Length**: Validates that text inputs (e.g., username, case summary snippets) adhere to specified length constraints. Errors: "Must be at least X characters long" or "Must be no more than Y characters long."
-   **Numeric Values**: Ensures that fields expecting numbers (e.g., age, financial amounts if applicable) contain only digits and fall within specified ranges if necessary.
-   **Specific Patterns (Regex)**: Custom regular expressions are used for fields requiring specific formats (e.g., Dutch phone numbers, postal codes, date formats if not using a date picker).
-   **File Upload Validation**:
    -   **File Type**: Validates that uploaded files match allowed extensions (e.g., .pdf, .doc, .docx, .txt, .jpg, .png). Error: "Invalid file type. Allowed types are: ..."
    -   **File Size**: Checks if uploaded files are within the maximum allowed size limit. Error: "File size exceeds the limit of X MB."

### 3. Form Submission Control

-   **Prevent Submission**: If any field fails validation, the form submission is prevented, and focus may be set to the first invalid field.
-   **Disabling Submit Button**: The submit button can be disabled until all required fields are validly filled, providing a clear indication to the user.

### 4. Accessibility

-   **ARIA Attributes**: Error messages are associated with their respective form fields using `aria-describedby` to ensure assistive technologies can announce errors to users.
-   **Focus Management**: When errors occur, focus is programmatically managed to help users quickly navigate to and correct the invalid fields.

### 5. JavaScript Implementation (`frontend/js/form-validation.js`)

-   **Generic Validation Functions**: The script contains reusable functions for common validation tasks (e.g., `isNotEmpty`, `isValidEmail`, `isMatchingPasswords`).
-   **Form-Specific Logic**: Each form on the platform has specific validation logic that calls these generic functions and handles the display of error/success messages.
-   **Error Message Display**: A consistent mechanism is used to display error messages, often by inserting or unhiding a dedicated error message element near the input field.
-   **Integration with Security Enhancements**: Works in tandem with `frontend/js/security-enhancements.js` for input sanitization to prevent XSS vulnerabilities before validation rules are applied.

By implementing robust client-side form validation, the platform enhances the user experience, guides users in providing correct information, and contributes to the overall data quality and security of the application.

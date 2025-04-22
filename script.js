// filepath: script.js
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

// Only add the login listener if the login form exists (i.e., we are on index.html)
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload
        errorMessage.textContent = ''; // Clear previous errors

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Base64 encode username:password for Basic Auth header
        const credentials = btoa(`${username}:${password}`); // Use btoa for Base64 encoding

        try {
            // IMPORTANT: Replace ((DOMAIN)) with the actual domain name provided for your school's GraphQL instance
            const response = await fetch('https://learn.reboot01.com/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`
                    // If the API expects JSON instead of Basic Auth:
                    // 'Content-Type': 'application/json',
                },
                // If the API expects JSON body:
                // body: JSON.stringify({ username: username, password: password })
            });

            if (response.ok) {
                // Read the response as plain text, as it's the raw JWT
                const jwtToken = await response.text();

                if (!jwtToken) {
                     // This case might be less likely now, but good to keep
                     console.error('Login successful, but received empty token response.');
                     errorMessage.textContent = 'Login succeeded, but failed to retrieve token.';
                     return; // Stop execution if token is empty
                }

                console.log('Login successful, received token:', jwtToken);
                // Store the raw token string
                localStorage.setItem('jwtToken', jwtToken);
                // Redirect to the profile page
                window.location.href = 'profile.html';
            } else {
                // Handle login errors (e.g., wrong credentials)
                const errorText = await response.text();
                console.error('Login failed:', response.status, errorText);
                errorMessage.textContent = `Login failed: ${response.status} ${errorText || '(Invalid credentials)'}`;
            }
        } catch (error) {
            console.error('Network or other error:', error);
            errorMessage.textContent = 'An error occurred during login. Please try again.';
        }
    });
} else {
    // This script might be loaded on profile.html erroneously if not careful,
    // but the core login logic is protected by the if(loginForm) check.
    console.log('Login form not found (expected if on profile page).');
}
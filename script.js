const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage.textContent = '';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const credentials = btoa(`${username}:${password}`);

        try {
            const response = await fetch('https://learn.reboot01.com/api/auth/signin', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (response.ok) {
                // *** Change: Use response.json() like the working example ***
                const data = await response.json();
                // *** Change: Assign the entire result to jwtToken ***
                const jwtToken = data;

                // *** Change: Check if jwtToken is a non-empty string ***
                if (jwtToken && typeof jwtToken === 'string' && jwtToken.length > 0) {
                    console.log('Login successful (using .json()), received token:', jwtToken);
                    Cookies.set('jwtToken', jwtToken, { expires: 7 });
                    window.location.href = 'profile.html';
                } else {
                     console.error('Login successful (using .json()), but received invalid data:', data);
                     errorMessage.textContent = 'Login succeeded, but failed to retrieve a valid token format.';
                }

            } else {
                const errorText = await response.text();
                console.error('Login failed:', response.status, errorText);
                if (response.status === 401) {
                    errorMessage.textContent = 'Login failed: Invalid username or password.';
                } else {
                    errorMessage.textContent = `Login failed: ${response.status} ${errorText || '(Server error)'}`;
                }
            }
        } catch (error) {
            // Catch potential JSON parsing errors too
            console.error('Network or processing error:', error);
            errorMessage.textContent = 'An error occurred during login. Please check network or try again.';
            if (error instanceof SyntaxError) { // Specifically catch JSON parse errors
                 errorMessage.textContent += ' (Could not parse server response as JSON)';
            }
        }
    });
} else {
    console.log('Login form not found (expected if on profile page).');
}
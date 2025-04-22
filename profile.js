// This script handles logic specifically for the profile page

// Function to fetch data using GraphQL
async function fetchGraphQL(query, token) {
    // Use the domain from script.js, ensure it's correct
    const graphqlEndpoint = 'https://learn.reboot01.com/api/graphql-engine/v1/graphql';
    try {
        const response = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Use the JWT token for authorization
            },
            body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GraphQL request failed: ${response.status} ${errorBody}`);
        }

        const result = await response.json();
        if (result.errors) {
            // Extract meaningful error message if possible
            const errorMessage = result.errors.map(e => e.message).join('; ');
            throw new Error(`GraphQL errors: ${errorMessage}`);
        }
        return result.data;
    } catch (error) {
        console.error('Error fetching GraphQL:', error);
        // Display a user-friendly error message on the profile page
        const userInfoDiv = document.getElementById('userInfo');
        if (userInfoDiv) {
             userInfoDiv.innerHTML = `<p style="color: red;">Error loading profile data. Please check console or try logging in again.</p><p style="color: red; font-size: 0.8em;">${error.message}</p>`;
        }
        // Clear other fields potentially
        document.getElementById('userLogin').textContent = 'Error';
        document.getElementById('userXP').textContent = 'Error';
        document.getElementById('userAudits').textContent = 'Error';
        return null; // Indicate failure
    }
}

// Function to format XP amount (Bytes to kB/MB)
function formatXP(amount) {
    if (amount === null || amount === undefined) return '0';
    if (amount < 1000) {
        return `${amount} B`;
    } else if (amount < 1000000) {
        return `${(amount / 1000).toFixed(2)} kB`;
    } else {
        return `${(amount / 1000000).toFixed(2)} MB`;
    }
}


// Function to fetch and display profile data
async function displayProfileData(token) {
    // GraphQL query to get user info, total XP, and audit transaction sums
    // Assumes the JWT token scopes the queries to the logged-in user
    const query = `
        query GetUserProfileData {
          # Get user's login and ID (ID might be useful for other queries)
          user {
            id
            login
          }
          # Aggregate total XP transactions for the user
          xp: transaction_aggregate(where: {type: {_eq: "xp"}}) {
            aggregate {
              sum {
                amount
              }
            }
          }
          # Aggregate total "up" audit transactions (XP gained from auditing others)
          auditUp: transaction_aggregate(where: {type: {_eq: "up"}}) {
             aggregate {
               sum {
                 amount
               }
             }
          }
          # Aggregate total "down" audit transactions (XP lost from being audited)
          auditDown: transaction_aggregate(where: {type: {_eq: "down"}}) {
             aggregate {
               sum {
                 amount
               }
             }
          }
          # You might need more queries here for graph data later
          # Example: XP transactions over time
          xpTransactions: transaction(where: {type: {_eq: "xp"}}, order_by: {createdAt: asc}) {
            amount
            createdAt
            objectId # Could link to object table for project name
            # object { name } # Nested query if needed
          }
          # Example: Audit results (pass/fail)
          auditsDone: audit(where: {grade: {_is_null: false}}, order_by: {createdAt: asc}) { # Assuming JWT scopes to auditorId = user.id
             grade
             createdAt
             # object { name } # Need to link audit -> group -> object? Or audit -> result -> object? Check relations
          }

        }
    `;

    console.log("Fetching data with token:", token ? "Present" : "Missing");
    const data = await fetchGraphQL(query, token);

    if (data) {
        console.log("Received data:", data);

        // Populate user info
        if (data.user && data.user.length > 0) {
            const user = data.user[0];
            document.getElementById('userLogin').textContent = user.login || 'N/A';
            console.log("User ID:", user.id); // Log user ID for potential debugging
        } else {
             document.getElementById('userLogin').textContent = 'Not found';
             console.warn("User data not found in response.");
        }

        // Populate total XP
        const totalXp = data.xp?.aggregate?.sum?.amount;
        document.getElementById('userXP').textContent = formatXP(totalXp);

        // Calculate and populate Audit Ratio (Up / Down)
        const totalUp = data.auditUp?.aggregate?.sum?.amount ?? 0;
        const totalDown = data.auditDown?.aggregate?.sum?.amount ?? 0;
        let auditRatio = 'N/A';
        if (totalDown > 0) {
            auditRatio = (totalUp / totalDown).toFixed(2);
        } else if (totalUp > 0) {
            auditRatio = 'Infinity (No down audits)';
        } else {
            auditRatio = '0.00 (No audits)';
        }
        document.getElementById('userAudits').textContent = `${auditRatio} (Up: ${formatXP(totalUp)} / Down: ${formatXP(totalDown)})`;


        // --- Call functions to render SVG graphs ---
        // Pass the relevant data to the graph functions
        renderXpOverTimeGraph(data.xpTransactions || []);
        renderPassFailRatioGraph(data.auditsDone || []); // Pass audit data

    } else {
        console.error("Failed to fetch or process profile data.");
        // Error message is already displayed by fetchGraphQL in case of failure
    }
}

// --- SVG Graph Rendering Functions (Placeholders - Implement these next) ---

function renderXpOverTimeGraph(xpData) {
    console.log("Rendering XP over time graph with data:", xpData);
    const svg = document.getElementById('svgXpOverTime');
    if (!svg) return;
    // Clear previous graph content
    svg.innerHTML = '';

    // --- Basic SVG rendering logic ---
    // 1. Define SVG dimensions and margins
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = +svg.getAttribute('width') - margin.left - margin.right;
    const height = +svg.getAttribute('height') - margin.top - margin.bottom;

    // 2. Create a group element shifted by margins
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
    svg.appendChild(g);

    if (!xpData || xpData.length === 0) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", width / 2);
        text.setAttribute("y", height / 2);
        text.setAttribute("text-anchor", "middle");
        text.textContent = "No XP data available.";
        g.appendChild(text);
        return;
    }

    // 3. Process data: Convert dates, calculate cumulative XP if needed
    let cumulativeXp = 0;
    const processedData = xpData.map(d => {
        cumulativeXp += d.amount;
        return {
            date: new Date(d.createdAt),
            value: cumulativeXp // Plot cumulative XP
            // value: d.amount // Or plot individual transaction amounts
        };
    });

    // 4. Define scales (time for X, linear for Y)
    const xScale = {
        min: processedData[0].date,
        max: processedData[processedData.length - 1].date,
        range: width
    };
    const yScale = {
        min: 0, // Start Y axis at 0
        max: Math.max(...processedData.map(d => d.value)), // Find max XP value
        range: height
    };

    // Helper to map data value to SVG coordinate
    const mapX = (date) => ((date - xScale.min) / (xScale.max - xScale.min)) * xScale.range;
    const mapY = (value) => yScale.range - ((value - yScale.min) / (yScale.max - yScale.min)) * yScale.range; // Invert Y for SVG

    // 5. Draw Axes (basic lines and labels)
    // X Axis Line
    const xAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxisLine.setAttribute("x1", 0);
    xAxisLine.setAttribute("y1", height);
    xAxisLine.setAttribute("x2", width);
    xAxisLine.setAttribute("y2", height);
    xAxisLine.setAttribute("stroke", "black");
    g.appendChild(xAxisLine);
    // Y Axis Line
    const yAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxisLine.setAttribute("x1", 0);
    yAxisLine.setAttribute("y1", 0);
    yAxisLine.setAttribute("x2", 0);
    yAxisLine.setAttribute("y2", height);
    yAxisLine.setAttribute("stroke", "black");
    g.appendChild(yAxisLine);

    // Add Axis Labels (simple)
    const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xLabel.setAttribute("x", width / 2);
    xLabel.setAttribute("y", height + margin.bottom - 5);
    xLabel.setAttribute("text-anchor", "middle");
    xLabel.textContent = "Time";
    g.appendChild(xLabel);

    const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    yLabel.setAttribute("transform", "rotate(-90)");
    yLabel.setAttribute("x", -height / 2);
    yLabel.setAttribute("y", -margin.left + 15);
    yLabel.setAttribute("text-anchor", "middle");
    yLabel.textContent = "Cumulative XP";
    g.appendChild(yLabel);

    // 6. Draw the data (e.g., a line chart)
    const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let dAttribute = "M"; // Start path command
    processedData.forEach((point, index) => {
        const x = mapX(point.date);
        const y = mapY(point.value);
        dAttribute += `${x},${y}${index === 0 ? "" : " L"}`; // MoveTo first point, LineTo subsequent points
    });
    linePath.setAttribute("d", dAttribute.trim());
    linePath.setAttribute("fill", "none");
    linePath.setAttribute("stroke", "steelblue");
    linePath.setAttribute("stroke-width", 2);
    g.appendChild(linePath);

    // Add points (optional)
    processedData.forEach(point => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", mapX(point.date));
        circle.setAttribute("cy", mapY(point.value));
        circle.setAttribute("r", 3);
        circle.setAttribute("fill", "steelblue");
        g.appendChild(circle);
    });
}


function renderPassFailRatioGraph(auditData) {
    console.log("Rendering Pass/Fail ratio graph with data:", auditData);
    const svg = document.getElementById('svgPassFail');
    if (!svg) return;
    svg.innerHTML = ''; // Clear previous graph

    // --- Basic SVG rendering logic for a Pie/Donut Chart ---
    const width = +svg.getAttribute('width');
    const height = +svg.getAttribute('height');
    const radius = Math.min(width, height) / 2 - 10; // Margin of 10
    const centerX = width / 2;
    const centerY = height / 2;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${centerX},${centerY})`);
    svg.appendChild(g);

    if (!auditData || auditData.length === 0) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", 0); // Centered due to transform
        text.setAttribute("y", 0); // Centered due to transform
        text.setAttribute("text-anchor", "middle");
        text.textContent = "No audit data available.";
        g.appendChild(text);
        return;
    }

    // 1. Process data: Count passes (grade >= 1) and fails (grade < 1)
    let passes = 0;
    let fails = 0;
    auditData.forEach(audit => {
        if (audit.grade >= 1) {
            passes++;
        } else {
            fails++;
        }
    });
    const total = passes + fails;

    if (total === 0) {
         const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", 0);
        text.setAttribute("y", 0);
        text.setAttribute("text-anchor", "middle");
        text.textContent = "No completed audits.";
        g.appendChild(text);
        return;
    }


    // 2. Calculate angles for pie slices
    const passAngle = (passes / total) * 2 * Math.PI;
    const failAngle = (fails / total) * 2 * Math.PI;

    let startAngle = 0;

    // Helper function to create a pie slice path
    function createSlice(startAngle, endAngle, color) {
        const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
        const startX = radius * Math.cos(startAngle);
        const startY = radius * Math.sin(startAngle);
        const endX = radius * Math.cos(endAngle);
        const endY = radius * Math.sin(endAngle);

        // d attribute for the path: M origin L start_point A radius,radius 0 largeArcFlag,1 end_point Z close_path
        const d = `M 0,0 L ${startX},${startY} A ${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY} Z`;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", color);
        return path;
    }

    // 3. Draw slices
    // Pass Slice (Green)
    if (passes > 0) {
        const passSlice = createSlice(startAngle, startAngle + passAngle, "mediumseagreen");
        g.appendChild(passSlice);
        startAngle += passAngle;
    }

    // Fail Slice (Red)
    if (fails > 0) {
        const failSlice = createSlice(startAngle, startAngle + failAngle, "tomato");
        g.appendChild(failSlice);
    }

    // 4. Add Labels (optional, simple text)
    const passPercentage = ((passes / total) * 100).toFixed(1);
    const failPercentage = ((fails / total) * 100).toFixed(1);

    const passLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    passLabel.setAttribute("x", 10); // Position labels outside the pie for simplicity
    passLabel.setAttribute("y", -centerY + 20);
    passLabel.textContent = `Pass: ${passes} (${passPercentage}%)`;
    passLabel.setAttribute("fill", "mediumseagreen");
    g.appendChild(passLabel);

    const failLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    failLabel.setAttribute("x", 10);
    failLabel.setAttribute("y", -centerY + 40);
    failLabel.textContent = `Fail: ${fails} (${failPercentage}%)`;
    failLabel.setAttribute("fill", "tomato");
    g.appendChild(failLabel);

}


// Function to handle logout
function logout() {
    localStorage.removeItem('jwtToken'); // Clear the token
    console.log('Logged out, token removed.');
    window.location.href = 'index.html'; // Redirect to login
}

// --- Execution starts here when profile.html loads ---

document.addEventListener('DOMContentLoaded', () => {
    // Get token from localStorage
    const token = localStorage.getItem('jwtToken');

    if (!token) {
        // If no token, redirect back to login
        console.log('No token found, redirecting to login.');
        window.location.href = 'index.html';
    } else {
        // Token found, fetch profile data
        console.log('Token found, fetching profile data...');
        displayProfileData(token);

        // Add event listener for the logout button
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        } else {
            console.warn('Logout button not found.');
        }
    }
});
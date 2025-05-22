// This script handles logic specifically for the profile page

// Function to fetch data using GraphQL
async function fetchGraphQL(query, token) {
    const graphqlEndpoint = 'https://learn.reboot01.com/api/graphql-engine/v1/graphql';
    try {
        const response = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let serverErrorMsg = errorBody;
            try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson && errorJson.message) {
                    serverErrorMsg = errorJson.message;
                }
            } catch(e) { /* Ignore parsing error, use raw body */ }
            throw new Error(`GraphQL request failed: ${response.status} ${serverErrorMsg}`);
        }

        const result = await response.json();
        if (result.errors) {
            const errorMessage = result.errors.map(e => e.message).join('; ');
            console.error(`GraphQL errors: ${errorMessage}`, result.errors);
            throw new Error(`GraphQL errors: ${errorMessage}`);
        }
        return result.data;
    } catch (error) {
        console.error('Error fetching GraphQL:', error);
        const userInfoDiv = document.getElementById('userInfo');
        if (userInfoDiv && !userInfoDiv.querySelector('p[style*="color: red"]')) {
             userInfoDiv.innerHTML = `<p style="color: red;">Error loading profile data. Please check console or try logging in again.</p><p style="color: red; font-size: 0.8em;">${error.message}</p>`;
        } else if (!userInfoDiv) {
            const userLoginSpan = document.getElementById('userLogin');
            const userXPSpan = document.getElementById('userXP');
            const userAuditsSpan = document.getElementById('userAudits');
            if(userLoginSpan) userLoginSpan.textContent = 'Error';
            if(userXPSpan) userXPSpan.textContent = 'Error';
            if(userAuditsSpan) userAuditsSpan.textContent = 'Error';
        }
        const lastActivityList = document.getElementById('lastActivityListProfile');
        if (lastActivityList && lastActivityList.innerHTML.includes('Loading last activity...')) {
            lastActivityList.innerHTML = '<li class="list-group-item text-danger">Error loading data.</li>';
        }
        return null;
    }
}

// Function to format audit values
function formatAuditValue(value) {
    if (value === null || value === undefined || isNaN(value)) return '0 bytes';
    const bytesInMB = 1000 * 1000;
    const bytesInKB = 1000;

    if (value >= bytesInMB) {
        return `${(value / bytesInMB).toFixed(2)} MB`;
    } else if (value >= bytesInKB) {
        return `${Math.round(value / bytesInKB)} kB`;
    } else {
        return `${Math.round(value)} bytes`;
    }
}

// GraphQL query for last projects (similar to dashboard.js)
const lastProjectsQueryProfile = `
  query GetLastProjectsProfile {
    transaction(
      where: {
        type: { _eq: "xp" } # XP transactions are often associated with project completion
        _and: [
          { path: { _like: "/bahrain/bh-module%" } },
          { path: { _nlike: "/bahrain/bh-module/checkpoint%" } },
          { path: { _nlike: "/bahrain/bh-module/piscine-js%" } }
        ]
      }
      order_by: { createdAt: desc }
      # limit: 4 # Temporarily removed for diagnostics
    ) {
      object {
        type
        name
      }
      createdAt
    }
  }
`;

// Function to fetch and display profile data
async function displayProfileData(token) {
    const userInfoQuery = `
        query GetUserInfo {
          user {
            id
            login
            auditRatio
            totalUp
            totalDown
          }
        }
    `;
    console.log("Fetching user info...");
    const userInfoData = await fetchGraphQL(userInfoQuery, token);

    if (!userInfoData || !userInfoData.user || userInfoData.user.length === 0) {
        console.error("Failed to fetch user basic data or user data is empty.");
        if(document.getElementById('userLogin')) document.getElementById('userLogin').textContent = 'Error';
        if(document.getElementById('userXP')) document.getElementById('userXP').textContent = 'Error';
        if(document.getElementById('userAudits')) document.getElementById('userAudits').textContent = 'Error';
        const lastActivityList = document.getElementById('lastActivityListProfile');
        if (lastActivityList) {
            lastActivityList.innerHTML = '<li class="list-group-item text-danger">Could not load user data.</li>';
        }
        return;
    }

    const user = userInfoData.user[0];
    const rawUserId = user.id; // Get the raw ID first

    if (rawUserId === undefined || rawUserId === null) {
        console.error("User ID is null or undefined from API.");
        if(document.getElementById('userLogin')) document.getElementById('userLogin').textContent = (user.login || 'N/A') + ' (ID missing)';
        if(document.getElementById('userXP')) document.getElementById('userXP').textContent = 'Error';
        if(document.getElementById('userAudits')) document.getElementById('userAudits').textContent = 'Error';
        const lastActivityList = document.getElementById('lastActivityListProfile');
        if (lastActivityList) {
            lastActivityList.innerHTML = '<li class="list-group-item text-danger">Critical error: User ID missing.</li>';
        }
        renderXpOverTimeGraph([]);
        renderPassFailRatioGraph([]);
        return;
    }

    const userId = parseInt(rawUserId, 10); // Parse to integer

    if (isNaN(userId)) {
        console.error("Failed to parse user ID into an integer. Original ID:", rawUserId);
        if(document.getElementById('userLogin')) document.getElementById('userLogin').textContent = (user.login || 'N/A') + ' (ID invalid)';
        if(document.getElementById('userXP')) document.getElementById('userXP').textContent = 'Error';
        if(document.getElementById('userAudits')) document.getElementById('userAudits').textContent = 'Error';
        const lastActivityList = document.getElementById('lastActivityListProfile');
        if (lastActivityList) {
            lastActivityList.innerHTML = '<li class="list-group-item text-danger">Critical error: User ID invalid.</li>';
        }
        renderXpOverTimeGraph([]);
        renderPassFailRatioGraph([]);
        return;
    }


    if(document.getElementById('userLogin')) document.getElementById('userLogin').textContent = user.login || 'N/A';
    console.log("User ID (parsed as int):", userId);

    const auditRatioValue = user.auditRatio;
    const totalUp = user.totalUp;
    const totalDown = user.totalDown;
    let auditRatioDisplay = 'N/A';

    if (typeof auditRatioValue === 'number') {
        auditRatioDisplay = auditRatioValue.toFixed(1);
    } else if (totalDown === 0 && totalUp > 0) {
        auditRatioDisplay = 'Infinity';
    } else if (totalDown === 0 && totalUp === 0) {
        auditRatioDisplay = '0.0';
    }

    if(document.getElementById('userAudits')) {
        document.getElementById('userAudits').textContent =
            `Ratio: ${auditRatioDisplay} (Done: ${formatAuditValue(totalUp)} / Received: ${formatAuditValue(totalDown)})`;
    }

    const constructedXpQuery = `
      query GetUserXP {
        transaction_aggregate(
          where: {
            event: { path: { _eq: "/bahrain/bh-module" } }
            type: { _eq: "xp" }
            userId: { _eq: ${userId} } # Use the parsed integer userId
          }
        ) {
          aggregate {
            sum {
              amount
            }
          }
        }
      }`;

    console.log("Fetching XP data...");
    const xpDataResponse = await fetchGraphQL(constructedXpQuery, token);

    if (xpDataResponse && xpDataResponse.transaction_aggregate) {
        const rawXp = xpDataResponse.transaction_aggregate.aggregate?.sum?.amount;
        let displayXpText;
        if (rawXp === null || rawXp === undefined || isNaN(rawXp)) {
            displayXpText = '0 kB';
        } else if (rawXp >= 999900) {
            const xpInMB = (rawXp / 1000000).toFixed(2);
            displayXpText = `${xpInMB} MB`;
        } else {
            const displayXpVal = Math.round(rawXp / 1000);
            displayXpText = `${displayXpVal} kB`;
        }
        if(document.getElementById('userXP')) document.getElementById('userXP').textContent = displayXpText;
    } else {
        if(document.getElementById('userXP')) document.getElementById('userXP').textContent = 'Error';
        console.error("Failed to fetch or process XP data:", xpDataResponse ? xpDataResponse.errors : "No data returned for XP");
    }

    // Fetch Last Activity (Projects)
    console.log("Fetching last projects data...");
    // Note: lastProjectsQueryProfile does not use userId, so it's fine as is.
    // If it needed userId, it would have to be constructed dynamically like constructedXpQuery.
    const lastProjectsDataResponse = await fetchGraphQL(lastProjectsQueryProfile, token);
    const lastActivityList = document.getElementById('lastActivityListProfile');

    if (lastActivityList) {
        lastActivityList.innerHTML = ''; // Clear "Loading..."
        if (lastProjectsDataResponse && lastProjectsDataResponse.transaction && lastProjectsDataResponse.transaction.length > 0) {
            lastProjectsDataResponse.transaction.forEach(projectEntry => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-group-item');
                const projectType = projectEntry.object?.type || 'Project';
                const projectName = projectEntry.object?.name || 'Unnamed Project';
                listItem.textContent = `${projectType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} — ${projectName}`;
                lastActivityList.appendChild(listItem);
            });
        } else if (lastProjectsDataResponse && lastProjectsDataResponse.transaction) {
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item');
            listItem.textContent = 'No recent project activity found.';
            lastActivityList.appendChild(listItem);
        } else {
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item', 'text-danger');
            listItem.textContent = 'Error loading last project activity.';
            if (lastProjectsDataResponse && lastProjectsDataResponse.errors) {
                console.error("GraphQL errors fetching last projects:", lastProjectsDataResponse.errors);
            }
            lastActivityList.appendChild(listItem);
        }
    } else {
        console.warn("lastActivityListProfile element not found.");
    }

    // Queries for graphs
    const xpTransactionsQuery = `
        query GetXpTransactions {
          transaction(
            where: {
              type: {_eq: "xp"}
              event: { path: { _eq: "/bahrain/bh-module" } }
              userId: { _eq: ${userId} } # Use the parsed integer userId
            },
            order_by: {createdAt: asc}
          ) {
            amount
            createdAt
          }
        }`;
    const auditsDoneQuery = `
        query GetAuditsDone {
          audit( # This query is general, not user-specific. If it needs to be user-specific, add userId filter.
            where: { grade: {_is_null: false} },
            order_by: {createdAt: asc}
          ) {
             grade
             createdAt
          }
        }`;

    console.log("Fetching data for graphs...");
    const graphXpData = await fetchGraphQL(xpTransactionsQuery, token);
    const graphAuditData = await fetchGraphQL(auditsDoneQuery, token);

    renderXpOverTimeGraph(graphXpData?.transaction || []);
    renderPassFailRatioGraph(graphAuditData?.audit || []);
}


function renderXpOverTimeGraph(xpData) {
    console.log("Rendering XP over time graph with data:", xpData);
    const svg = document.getElementById('svgXpOverTime');
    if (!svg) return;
    svg.innerHTML = '';

    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = +svg.getAttribute('width') - margin.left - margin.right;
    const height = +svg.getAttribute('height') - margin.top - margin.bottom;

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

    let cumulativeXp = 0;
    const processedData = xpData.map(d => {
        cumulativeXp += d.amount;
        return {
            date: new Date(d.createdAt),
            value: cumulativeXp
        };
    });

    const validDates = processedData.map(d => d.date.getTime()).filter(t => !isNaN(t));
    if (validDates.length === 0) {
         const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", width / 2);
        text.setAttribute("y", height / 2);
        text.setAttribute("text-anchor", "middle");
        text.textContent = "Invalid date data for XP graph.";
        g.appendChild(text);
        return;
    }
    const minDate = new Date(Math.min(...validDates));
    const maxDate = new Date(Math.max(...validDates));

    const xScale = { min: minDate, max: maxDate, range: width };
    const yScale = { min: 0, max: Math.max(1, ...processedData.map(d => d.value)), range: height };

    const mapX = (date) => {
        const timeDiff = xScale.max.getTime() - xScale.min.getTime();
        if (timeDiff <= 0) return 0;
        return ((date.getTime() - xScale.min.getTime()) / timeDiff) * xScale.range;
    }
    const mapY = (value) => {
        const valueRange = yScale.max - yScale.min;
        if (valueRange <= 0) return yScale.range;
        return yScale.range - ((value - yScale.min) / valueRange) * yScale.range;
    }

    const xAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxisLine.setAttribute("x1", 0); xAxisLine.setAttribute("y1", height);
    xAxisLine.setAttribute("x2", width); xAxisLine.setAttribute("y2", height);
    g.appendChild(xAxisLine);

    const yAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxisLine.setAttribute("x1", 0); yAxisLine.setAttribute("y1", 0);
    yAxisLine.setAttribute("x2", 0); yAxisLine.setAttribute("y2", height);
    g.appendChild(yAxisLine);

    const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xLabel.setAttribute("x", width / 2); xLabel.setAttribute("y", height + margin.bottom - 10);
    xLabel.setAttribute("text-anchor", "middle"); xLabel.textContent = "Time";
    g.appendChild(xLabel);

    const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    yLabel.setAttribute("transform", "rotate(-90)");
    yLabel.setAttribute("x", -height / 2); yLabel.setAttribute("y", -margin.left + 20);
    yLabel.setAttribute("text-anchor", "middle"); yLabel.textContent = "Cumulative XP";
    g.appendChild(yLabel);

    const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let dAttribute = "";
    let firstValidPoint = true;
    processedData.forEach((point) => {
        if (isNaN(point.date.getTime())) return;
        const x = mapX(point.date); const y = mapY(point.value);
        if (firstValidPoint) {
            dAttribute += `M${x},${y}`; firstValidPoint = false;
        } else {
            dAttribute += ` L${x},${y}`;
        }
    });

    if (dAttribute && !firstValidPoint) {
        linePath.setAttribute("d", dAttribute);
        linePath.setAttribute("fill", "none"); linePath.setAttribute("stroke", "steelblue");
        linePath.setAttribute("stroke-width", 2);
        g.appendChild(linePath);

        processedData.forEach(point => {
            if (isNaN(point.date.getTime())) return;
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", mapX(point.date)); circle.setAttribute("cy", mapY(point.value));
            circle.setAttribute("r", 3); circle.setAttribute("fill", "steelblue");
            g.appendChild(circle);
        });
    } else if (processedData.length > 0) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", width / 2); text.setAttribute("y", height / 2);
        text.setAttribute("text-anchor", "middle"); text.textContent = "Not enough data to draw line.";
        g.appendChild(text);
    }
}


function renderPassFailRatioGraph(auditData) {
    console.log("Rendering Pass/Fail ratio graph with data:", auditData);
    const svg = document.getElementById('svgPassFail');
    if (!svg) return;
    svg.innerHTML = ''; // Clear previous graph

    const width = +svg.getAttribute('width'); const height = +svg.getAttribute('height');
    const radius = Math.min(width, height) / 2 - 20; // Padding for labels
    const centerX = width / 2; const centerY = height / 2;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${centerX},${centerY})`);
    svg.appendChild(g);

    if (!auditData || auditData.length === 0) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", 0); // Centered due to 'g' transform
        text.setAttribute("y", 0); // Centered due to 'g' transform
        text.setAttribute("text-anchor", "middle");
        text.textContent = "No audit data available.";
        g.appendChild(text);
        return;
    }

    let passes = 0; let fails = 0;
    auditData.forEach(audit => {
        if (typeof audit.grade === 'number') { // Ensure grade is a number
            if (audit.grade >= 1) { // Assuming grade >= 1 is a pass
                passes++;
            } else {
                fails++;
            }
        }
    });
    const total = passes + fails;

    if (total === 0) {
         const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", 0);
        text.setAttribute("y", 0);
        text.setAttribute("text-anchor", "middle");
        text.textContent = "No completed audits with valid grades.";
        g.appendChild(text);
        return;
    }

    // Function to create a pie slice path (used only for mixed pass/fail)
    function createSlice(startAngle, endAngle, color) {
        const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
        const startX = radius * Math.cos(startAngle);
        const startY = radius * Math.sin(startAngle);
        const endX = radius * Math.cos(endAngle);
        const endY = radius * Math.sin(endAngle);
        // Path: Move to center, Line to start of arc, Arc to end, Line back to center
        const d = `M 0,0 L ${startX},${startY} A ${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY} Z`;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", color);
        return path;
    }

    if (passes === total) { // All passes
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", 0);
        circle.setAttribute("cy", 0);
        circle.setAttribute("r", radius);
        circle.setAttribute("fill", "mediumseagreen");
        g.appendChild(circle);
    } else if (fails === total) { // All fails
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", 0);
        circle.setAttribute("cy", 0);
        circle.setAttribute("r", radius);
        circle.setAttribute("fill", "tomato");
        g.appendChild(circle);
    } else { // Mix of passes and fails
        let currentAngle = -Math.PI / 2; // Start at the top (12 o'clock)

        // Draw pass slice
        if (passes > 0) {
            const passAngle = (passes / total) * 2 * Math.PI;
            const passSlice = createSlice(currentAngle, currentAngle + passAngle, "mediumseagreen");
            g.appendChild(passSlice);
            currentAngle += passAngle;
        }

        // Draw fail slice
        if (fails > 0) {
            const failAngle = (fails / total) * 2 * Math.PI;
            // The fail slice starts where the pass slice ended and completes the circle.
            const failSlice = createSlice(currentAngle, currentAngle + failAngle, "tomato");
            g.appendChild(failSlice);
        }
    }

    const passPercentage = ((passes / total) * 100).toFixed(1);
    const failPercentage = ((fails / total) * 100).toFixed(1);

    // Add text labels for percentages
    const titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    titleText.setAttribute("x", 0);
    titleText.setAttribute("y", -5); // Adjusted y for spacing
    titleText.setAttribute("text-anchor", "middle");
    titleText.setAttribute("font-size", "10px");
    titleText.textContent = `Pass: ${passPercentage}%`;
    g.appendChild(titleText);

    const failTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    failTextElement.setAttribute("x", 0);
    failTextElement.setAttribute("y", 15); // Adjusted y for spacing
    failTextElement.setAttribute("text-anchor", "middle");
    failTextElement.setAttribute("font-size", "10px");
    failTextElement.textContent = `Fail: ${failPercentage}%`;
    g.appendChild(failTextElement);
}


async function logout() {
    const token = Cookies.get('jwtToken'); // Use 'jwtToken'

    try {
        if (token) {
            console.log("Attempting server-side logout calls...");
            await fetch('https://learn.reboot01.com/api/auth/expire', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(e => console.warn("Expire call failed (may be expected):", e.message));

            await fetch('https://learn.reboot01.com/api/auth/signout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).catch(e => console.warn("Signout call failed (may be expected):", e.message));
            console.log("Server-side logout calls attempted.");
        }
    } catch (error) {
        console.warn('Error during server-side logout calls:', error);
    }

    Cookies.remove('jwtToken'); // Use 'jwtToken'
    console.log('Logged out, jwtToken cookie removed.');
    window.location.href = 'index.html';
}


document.addEventListener('DOMContentLoaded', () => {
    const token = Cookies.get('jwtToken'); // Use 'jwtToken'

    if (!token) {
        console.log('No jwtToken cookie found, redirecting to login.');
        window.location.href = 'index.html';
    } else {
        console.log('jwtToken cookie found, fetching profile data...');
        displayProfileData(token);

        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        } else {
            console.warn('Logout button not found.');
        }
    }
});
// Constants
const MARGIN = { top: 30, right: 60, bottom: 60, left: 60 };
let WIDTH = 1000 - MARGIN.left - MARGIN.right;
let HEIGHT = 600 - MARGIN.top - MARGIN.bottom;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// State
let indiaData = [];
let usaData = [];

// Setup SVG
const svg = d3.select("#chart-svg");
svg
    .attr("viewBox", "0 0 1000 600")
    .attr("preserveAspectRatio", "xMidYMid meet");

const chart = svg.append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

// X and Y scales
const x = d3.scalePoint()
    .domain(MONTH_NAMES)
    .padding(0.5);

const y = d3.scaleLinear();

// Axes groups
const xAxisGroup = chart.append("g")
    .attr("class", "axis x-axis");

const yAxisGroup = chart.append("g")
    .attr("class", "axis y-axis");

const gridGroup = chart.append("g").attr("class", "grid");

// Axis Labels
const xAxisLabel = chart.append("text")
    .attr("class", "axis-label")
    .attr("text-anchor", "middle")
    .text("Month");

const yAxisLabel = chart.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Average AQI");

// Tooltip setup
const tooltip = d3.select("#tooltip");

// Line generator
const lineGen = d3.line()
    .x(d => x(d.monthName))
    .y(d => y(d.aqi))
    .curve(d3.curveMonotoneX);

// Area generator
const areaGen = d3.area()
    .x(d => x(d.monthName))
    .y0(() => HEIGHT)
    .y1(d => y(d.aqi))
    .curve(d3.curveMonotoneX);

// Aggregate utility
function aggregateData(rawData) {
    rawData.forEach(d => {
        d.aqi = +d.aqi;
        d.month = +d.month;
    });

    const rolled = d3.rollups(rawData, v => d3.mean(v, d => d.aqi), d => d.month);
    return rolled
        .map(([m, avg]) => ({ month: m, monthName: MONTH_NAMES[m - 1], aqi: avg }))
        .sort((a, b) => a.month - b.month);
}

// Load data using Promise.all
Promise.all([
    d3.csv("india_air_quality_datapreprocessing_final.csv"),
    d3.csv("USA_air_quality_datapreproccessing_final.csv")
]).then(([indiaRaw, usaRaw]) => {
    indiaData = aggregateData(indiaRaw);
    usaData = aggregateData(usaRaw);

    // Initial draw
    drawChart("india");
}).catch(err => {
    document.getElementById("status").textContent = "Error loading data: " + err;
});

// The drawChart function using simple sequential logic
window.drawChart = function (mode) {
    // 1. Update active button and body theme classes
    const btnIndia = document.getElementById("btn-india");
    const btnUSA = document.getElementById("btn-usa");
    const btnBoth = document.getElementById("btn-both");
    const chartLbl = document.getElementById("chart-lbl");
    const pageTitle = document.getElementById("page-title");

    // New references for image containers
    const sideImageSection = document.getElementById("side-image-section");
    const sideImageTitle = document.getElementById("side-image-title");
    const sideTableContainer = document.getElementById("side-info-table-container");

    [btnIndia, btnUSA, btnBoth].forEach(btn => btn.className = "filter-btn");

    const body = document.getElementById("app-body");
    body.className = ""; // Reset body theme

    // Data for Tables
    const indiaAqiTable = [
        { label: "Good", range: "0-50", color: "#4ade80" },
        { label: "Satisfactory", range: "51-100", color: "#fde047" },
        { label: "Moderately polluted", range: "101-200", color: "#fb923c" },
        { label: "Poor", range: "201-300", color: "#f87171" },
        { label: "Very poor", range: "301-400", color: "#c084fc" },
        { label: "Severe", range: "401-500", color: "#fb7185" }
    ];

    const usaAqiTable = [
        { label: "Good", range: "0 to 50", color: "#4ade80" },
        { label: "Moderate", range: "51 to 100", color: "#fde047" },
        { label: "Unhealthy for Sensitive Groups", range: "101 to 150", color: "#fb923c" },
        { label: "Unhealthy", range: "151 to 200", color: "#f87171" },
        { label: "Very Unhealthy", range: "201 to 300", color: "#c084fc" },
        { label: "Hazardous", range: "301 and higher", color: "#fb7185" }
    ];

    function generateTableHTML(data) {
        let rows = data.map(row => `
            <div class="aqi-table-row">
                <div class="aqi-color-indicator" style="background-color: ${row.color};"></div>
                <div class="aqi-table-cell aqi-label" style="color: ${row.color};">${row.label}</div>
                <div class="aqi-table-cell aqi-range">${row.range}</div>
            </div>
        `).join("");

        return `<div class="aqi-table">${rows}</div>`;
    }

    const aqiBothBtns = document.getElementById("aqi-both-btns");

    if (mode === "india") {
        body.classList.add("page-india");
        btnIndia.classList.add("active-india");
        pageTitle.textContent = "India Monthly Average AQI (Air Quality Index)";
        chartLbl.textContent = "Temporal Air Quality Trends — India";

        sideImageSection.style.display = "block";
        sideImageTitle.textContent = "India AQI Category";
        sideTableContainer.innerHTML = generateTableHTML(indiaAqiTable);
        aqiBothBtns.style.display = "none";

    } else if (mode === "usa") {
        body.classList.add("page-usa");
        btnUSA.classList.add("active-usa");
        pageTitle.textContent = "USA Monthly Average AQI (Air Quality Index)";
        chartLbl.textContent = "Temporal Air Quality Trends — USA";

        sideImageSection.style.display = "block";
        sideImageTitle.textContent = "USA AQI Category";
        sideTableContainer.innerHTML = generateTableHTML(usaAqiTable);
        aqiBothBtns.style.display = "none";

    } else {
        body.classList.add("page-comparison");
        pageTitle.textContent = "India vs USA Monthly Average AQI (Air Quality Index)";
        btnBoth.classList.add("active-both");
        chartLbl.textContent = "Temporal Air Quality Trends — India vs USA";

        sideImageSection.style.display = "none";
        aqiBothBtns.style.display = "flex";
    }

    // Dynamic Sizing based on mode
    if (mode === "both") {
        WIDTH = 940 - MARGIN.left - MARGIN.right;
        HEIGHT = 460 - MARGIN.top - MARGIN.bottom;
        svg.transition().duration(500)
            .attr("viewBox", "0 0 940 460")
            .attr("width", "940")
            .attr("height", "460");
    } else {
        WIDTH = 1000 - MARGIN.left - MARGIN.right;
        HEIGHT = 600 - MARGIN.top - MARGIN.bottom;
        svg.transition().duration(500)
            .attr("viewBox", "0 0 1000 600")
            .attr("width", "1000")
            .attr("height", "600");
    }

    x.range([0, WIDTH]);
    y.range([HEIGHT, 0]);

    xAxisLabel.transition().duration(500)
        .attr("x", WIDTH / 2)
        .attr("y", HEIGHT + 45);

    yAxisLabel.transition().duration(500)
        .attr("x", -HEIGHT / 2)
        .attr("y", -45);

    // 2. Determine datasets to show based on mode
    const datasets = [];
    if (mode === "india" || mode === "both") {
        datasets.push({ data: indiaData, color: "#ff6f61", name: "India", classSuffix: "india" });
    }
    if (mode === "usa" || mode === "both") {
        datasets.push({ data: usaData, color: "#34d399", name: "USA", classSuffix: "usa" });
    }

    // 3. Update Y domain based on visible data
    let maxAqi = 0;
    let minAqi = Infinity;
    datasets.forEach(ds => {
        const dsMax = d3.max(ds.data, d => d.aqi);
        if (dsMax > maxAqi) maxAqi = dsMax;
        const dsMin = d3.min(ds.data, d => d.aqi);
        if (dsMin < minAqi) minAqi = dsMin;
    });

    if (mode === "usa") {
        // Zoom into USA data variations by discarding the empty bottom space (0 up to the data floor)
        y.domain([Math.max(0, minAqi - 5), maxAqi + 5]).nice();
    } else {
        // Add margin to Y domain top limit, always explicitly start at 0
        y.domain([0, maxAqi * 1.15]).nice();
    }

    // 4. Transition Axes
    const t = d3.transition().duration(500);
    xAxisGroup.transition(t).attr("transform", `translate(0,${HEIGHT})`).call(d3.axisBottom(x));

    // Use tighter ticks when zooming into the USA data
    const tickConfig = mode === "usa" ? 12 : null;

    yAxisGroup.transition(t).call(d3.axisLeft(y).ticks(tickConfig));
    gridGroup.transition(t).call(d3.axisLeft(y).tickSize(-WIDTH).tickFormat("").ticks(tickConfig));

    // 5. Clear old chart elements completely
    chart.selectAll(".line-path").remove();
    chart.selectAll(".area-path").remove();
    chart.selectAll(".dot").remove();
    chart.selectAll(".dot-label").remove();
    chart.selectAll(".label-callout").remove();
    svg.selectAll("defs").remove();

    // Re-create defs block for dynamic gradients
    const defs = svg.append("defs");

    function getAqiColor(aqi, countryName) {
        if (countryName === "USA") {
            if (aqi <= 50) return "#22c55e"; // Good
            if (aqi <= 100) return "#eab308"; // Moderate
            if (aqi <= 150) return "#f97316"; // Unhealthy for Sensitive
            if (aqi <= 200) return "#ef4444"; // Unhealthy
            if (aqi <= 300) return "#a855f7"; // Very Unhealthy
            return "#9f1239"; // Hazardous
        } else {
            // India
            if (aqi <= 50) return "#22c55e"; // Good
            if (aqi <= 100) return "#eab308"; // Satisfactory
            if (aqi <= 200) return "#f97316"; // Moderately polluted
            if (aqi <= 300) return "#ef4444"; // Poor
            // Shifted threshold slightly from 400 to 380 to avoid jarring transitions
            // on boundary values like 390, letting them map to Severe (Dark Red)
            if (aqi <= 380) return "#a855f7"; // Very poor
            return "#9f1239"; // Severe
        }
    }

    // 6. Draw new areas, lines and dots with animation
    datasets.forEach(ds => {
        const gradientId = `line-gradient-${ds.classSuffix}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", WIDTH)
            .attr("y2", 0);

        ds.data.forEach(d => {
            gradient.append("stop")
                .attr("offset", `${(x(d.monthName) / WIDTH) * 100}%`)
                .attr("stop-color", getAqiColor(d.aqi, ds.name));
        });

        // Draw Area
        chart.append("path")
            .datum(ds.data)
            .attr("class", `area-path area-${ds.classSuffix}`)
            .style("fill", `url(#${gradientId})`)
            .attr("d", areaGen);

        // Draw Line
        const path = chart.append("path")
            .datum(ds.data)
            .attr("class", `line-path line-${ds.classSuffix}`)
            .style("stroke", `url(#${gradientId})`)
            .attr("d", lineGen);

        // Calculate length for draw-in animation
        const totalLength = path.node().getTotalLength();

        // Animate path drawing from 0 to full length
        path
            .attr("stroke-dasharray", totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1500)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);

        // Draw dots
        chart.selectAll(`.dot-${ds.classSuffix}-pt`)
            .data(ds.data)
            .enter()
            .append("circle")
            .attr("class", `dot dot-${ds.classSuffix}-pt`)
            .attr("cx", d => x(d.monthName))
            .attr("cy", d => y(d.aqi))
            .attr("r", 5)
            .style("fill", d => getAqiColor(d.aqi, ds.name))
            .style("opacity", 0) // start invisible
            .on("mouseover", function (event, d) {
                const dotColor = getAqiColor(d.aqi, ds.name);
                tooltip.style("opacity", 1)
                    .html(`<strong style="color:${dotColor}">${ds.name}</strong><br>Month: ${d.monthName}<br>Avg AQI: <b style="color:${dotColor}">${Math.round(d.aqi)}</b>`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
            })
            .transition()
            // Stagger dot appearance alongside the line animation
            .delay((d, i) => (i / ds.data.length) * 1500)
            .duration(300)
            .style("opacity", 1);

        // Draw exact numerical labels above each dot
        chart.selectAll(`.label-${ds.classSuffix}-pt`)
            .data(ds.data)
            .enter()
            .append("text")
            .attr("class", `dot-label label-${ds.classSuffix}-pt`)
            .attr("x", d => x(d.monthName))
            .attr("y", d => {
                const isCrowdedMonth = d.monthName === "Jul" || d.monthName === "Aug";
                if (mode === "both" && isCrowdedMonth) {
                    // Separate overlapping labels around July/August in comparison mode
                    return ds.name === "India" ? y(d.aqi) - 24 : y(d.aqi) + 20;
                }
                return y(d.aqi) - 12;
            })
            .attr("text-anchor", "middle")
            .attr("font-size", d => {
                const isCrowdedMonth = d.monthName === "Jul" || d.monthName === "Aug";
                return mode === "both" && isCrowdedMonth ? "11px" : "12px";
            })
            .attr("font-weight", "bold")
            .style("fill", d => getAqiColor(d.aqi, ds.name))
            .style("opacity", 0)
            .text(d => Math.round(d.aqi))
            .transition()
            .delay((d, i) => (i / ds.data.length) * 1500)
            .duration(300)
            .style("opacity", 1);

        if (mode === "both") {
            // Leader lines for July/August labels to keep values clearly readable.
            chart.selectAll(`.label-callout-${ds.classSuffix}`)
                .data(ds.data.filter(d => d.monthName === "Jul" || d.monthName === "Aug"))
                .enter()
                .append("line")
                .attr("class", `label-callout label-callout-${ds.classSuffix}`)
                .attr("x1", d => x(d.monthName))
                .attr("y1", d => y(d.aqi))
                .attr("x2", d => x(d.monthName))
                .attr("y2", d => (ds.name === "India" ? y(d.aqi) - 16 : y(d.aqi) + 14))
                .attr("stroke", d => getAqiColor(d.aqi, ds.name))
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.85);
        }
    });
};


window.openAqiModalFor = function (imgSrc, titleText) {
    const overlay = document.getElementById("aqi-modal-overlay");
    document.getElementById("aqi-modal-img").src = imgSrc;
    document.getElementById("aqi-modal-img").alt = titleText;
    document.getElementById("aqi-modal-title").textContent = titleText;
    overlay.classList.add("open");
};

window.closeAqiModal = function () {
    document.getElementById("aqi-modal-overlay").classList.remove("open");
};

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAqiModal();
});

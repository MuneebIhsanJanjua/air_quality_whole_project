// Chart size
const margin = {top:20, right:30, bottom:40, left:50};
const width = 600 - margin.left - margin.right;
const height = 300 - margin.top - margin.bottom;


// Dummy data (just structure for now)
const usaData = [
{season:"Spring", value:30},
{season:"Summer", value:25},
{season:"Winter", value:25},
{season:"Fall", value:20}
];

const indiaData = [
{season:"Winter", value:680},
{season:"Post-Monsoon", value:520},
{season:"Summer", value:180},
{season:"Monsoon", value:80}
];


// Function to create chart
function createChart(container, data){

const svg = d3.select(container)
.append("svg")
.attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom)
.append("g")
.attr("transform", `translate(${margin.left},${margin.top})`);


// X scale
const x = d3.scaleBand()
.domain(data.map(d => d.season))
.range([0,width])
.padding(0.2);


// Y scale
const y = d3.scaleLinear()
.domain([0, d3.max(data, d => d.value)])
.range([height,0]);


// X Axis
svg.append("g")
.attr("transform", `translate(0,${height})`)
.call(d3.axisBottom(x));


// Y Axis
svg.append("g")
.call(d3.axisLeft(y));


// Bars
svg.selectAll(".bar")
.data(data)
.enter()
.append("rect")
.attr("class","bar")
.attr("x", d => x(d.season))
.attr("y", d => y(d.value))
.attr("width", x.bandwidth())
.attr("height", d => height - y(d.value));

}


// Create charts
createChart("#usa-chart", usaData);
createChart("#india-chart", indiaData);
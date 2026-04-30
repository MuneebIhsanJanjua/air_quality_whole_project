const tooltip = d3.select(".tooltip");

const monthNames = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

let currentCountry = "india";
let currentTime = "month";

Promise.all([
  d3.csv("india_air_quality_datapreprocessing_final.csv"),
  d3.csv("USA_air_quality_datapreproccessing_final.csv")
]).then(function(data){

  let india = data[0];
  let usa = data[1];

  india.forEach(d => {
    d.temperature = +d.temperature;
    d.wind_speed = +d.wind_speed;
    d.month = +d.month;
    d.year = +d.year;
    d.quarter = "Q" + Math.ceil(d.month / 3);
  });

  usa.forEach(d => {
    d.temperature = +d.temperature;
    d.wind_speed = +d.wind_speed;
    d.month = +d.month;
    d.year = +d.year;
    d.quarter = "Q" + Math.ceil(d.month / 3);
  });

  function buildDataset(sourceData, type){
    if(type === "month"){
      return d3.rollups(
        sourceData,
        v => ({
          temperature: d3.mean(v, d => d.temperature),
          wind_speed: d3.mean(v, d => d.wind_speed)
        }),
        d => d.month
      ).map(d => ({
        label: monthNames[d[0] - 1],
        temperature: d[1].temperature,
        wind_speed: d[1].wind_speed
      }));
    }

    if(type === "quarter"){
      return d3.rollups(
        sourceData,
        v => ({
          temperature: d3.mean(v, d => d.temperature),
          wind_speed: d3.mean(v, d => d.wind_speed)
        }),
        d => d.quarter
      ).map(d => ({
        label: d[0],
        temperature: d[1].temperature,
        wind_speed: d[1].wind_speed
      }));
    }

    if(type === "year"){
      return d3.rollups(
        sourceData,
        v => ({
          temperature: d3.mean(v, d => d.temperature),
          wind_speed: d3.mean(v, d => d.wind_speed)
        }),
        d => d.year
      ).map(d => ({
        label: d[0],
        temperature: d[1].temperature,
        wind_speed: d[1].wind_speed
      }));
    }
  }

  const datasets = {
    india: {
      month: buildDataset(india, "month"),
      quarter: buildDataset(india, "quarter"),
      year: buildDataset(india, "year")
    },
    usa: {
      month: buildDataset(usa, "month"),
      quarter: buildDataset(usa, "quarter"),
      year: buildDataset(usa, "year")
    }
  };

  function updateSidePanel(dataset, country, time){
  const avgTemp = d3.mean(dataset, d => d.temperature).toFixed(2);
  const avgWind = d3.mean(dataset, d => d.wind_speed).toFixed(2);

  const peak = dataset.reduce((a, b) =>
    (a.temperature + a.wind_speed) > (b.temperature + b.wind_speed) ? a : b
  );

  const maxTotal = (peak.temperature + peak.wind_speed).toFixed(2);

  document.getElementById("avgTemp").innerText = avgTemp + " °C";
  document.getElementById("avgWind").innerText = avgWind + " km/h";
  document.getElementById("peakPeriod").innerText = peak.label;
  document.getElementById("maxTotal").innerText = maxTotal;

  let timeWord = "month";
  if(time === "quarter") timeWord = "quarter";
  if(time === "year") timeWord = "year";

  document.getElementById("insightText").innerText =
    `${country.toUpperCase()} shows its highest combined temperature and wind in ${peak.label}, making it the strongest ${timeWord} in the current view.`;
}
  function drawChart(dataset, country, time){
    const svg = d3.select("#mainChart");
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 20, bottom: 60, left: 70 };
    const fullWidth = +svg.attr("width");
    const fullHeight = +svg.attr("height");
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const chart = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const keys = ["temperature", "wind_speed"];
    const stack = d3.stack().keys(keys);
    const stackedData = stack(dataset);

    const x = d3.scaleBand()
      .domain(dataset.map(d => d.label))
      .range([0, width])
      .padding(0.3);

    const maxValue = d3.max(dataset, d => d.temperature + d.wind_speed);

    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.15])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(keys)
      .range(["#c43b0a", "#4dabf7"]);

    const grid = chart.append("g")
      .call(
        d3.axisLeft(y)
          .tickSize(-width)
          .tickFormat("")
      );

    grid.selectAll("line")
      .style("stroke", "rgba(255,255,255,0.15)");

    grid.select(".domain").remove();

    const xAxis = chart.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    xAxis.selectAll("text")
      .style("fill", "white")
      .style("font-size", "13px");

    xAxis.selectAll(".tick line")
      .style("stroke", "white");

    xAxis.select(".domain")
      .style("stroke", "white")
      .style("stroke-width", 2);

    const yAxis = chart.append("g")
      .call(d3.axisLeft(y).ticks(6));

    yAxis.selectAll("text")
      .style("fill", "white")
      .style("font-size", "13px");

    yAxis.selectAll(".tick line")
      .style("stroke", "white");

    yAxis.select(".domain")
      .style("stroke", "white")
      .style("stroke-width", 1.5);

    const groups = chart.selectAll(".layer")
      .data(stackedData)
      .enter()
      .append("g")
      .attr("fill", d => color(d.key));

    const bars = groups.selectAll("rect")
      .data(d => d)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.data.label))
      .attr("width", x.bandwidth())
      .attr("rx", 4)
      .attr("y", height)
      .attr("height", 0);

    bars.transition()
      .duration(800)
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]));

   bars.on("mouseenter", function(event, d){

    d3.selectAll("#mainChart .bar")
      .transition()
      .duration(150)
      .style("opacity", 0.25)
      .style("stroke", "none");

    d3.select(this)
      .transition()
      .duration(150)
      .style("opacity", 1)
      .style("stroke", "#ffffff")
      .style("stroke-width", 2)
      .attr("transform", "translate(0,-6)");

    const layerKey = d3.select(this.parentNode).datum().key;

    let valueText = "";
    if(layerKey === "temperature"){
      valueText = `Temp: ${d.data.temperature.toFixed(2)} °C`;
    } else {
      valueText = ` Wind: ${d.data.wind_speed.toFixed(2)} km/h`;
    }

    tooltip
      .style("opacity", 1)
      .html(`
        <b>${currentCountry.toUpperCase()} - ${d.data.label}</b><br>
        ${valueText}
      `);
})
.on("mousemove", function(event){
    tooltip
      .style("left", (event.clientX + 16) + "px")
      .style("top", (event.clientY - 20) + "px");
})
.on("mouseleave", function(){
    d3.selectAll("#mainChart .bar")
      .transition()
      .duration(150)
      .style("opacity", 1)
      .style("stroke", "none")
      .attr("transform", "translate(0,0)");

    tooltip.style("opacity", 0);
});

    let timeLabel = "Monthly";
    if(time === "quarter") timeLabel = "Quarterly";
    if(time === "year") timeLabel = "Yearly";

    document.getElementById("chartTitle").innerText =
      `${country.toUpperCase()} - ${timeLabel} Data`;
  }

  function updateMainChart(){
    const currentDataset = datasets[currentCountry][currentTime];
    drawChart(currentDataset, currentCountry, currentTime);
    updateSidePanel(currentDataset, currentCountry, currentTime);
}
  window.setCountry = function(country){
    currentCountry = country;
    updateMainChart();
  };

  window.setTime = function(time){
    currentTime = time;
    updateMainChart();
  };

  updateMainChart();

}).catch(function(error){
  console.error("Error loading CSV files:", error);
});bars.on("mouseenter", function(event, d){

    d3.selectAll("#mainChart .bar")
      .transition()
      .duration(150)
      .style("opacity", 0.25)
      .style("stroke", "none");

    d3.select(this)
      .transition()
      .duration(150)
      .style("opacity", 1)
      .style("stroke", "#ffffff")
      .style("stroke-width", 2)
      .attr("transform", "translate(0,-6)");

    const layerKey = d3.select(this.parentNode).datum().key;

    let valueText = "";
    if(layerKey === "temperature"){
      valueText = `Temp: ${d.data.temperature.toFixed(2)} °C`;
    } else {
      valueText = `Wind: ${d.data.wind_speed.toFixed(2)} km/h`;
    }

    tooltip
      .style("opacity", 1)
      .html(`
        <b>${currentCountry.toUpperCase()} - ${d.data.label}</b><br>
        ${valueText}
      `);
})
.on("mousemove", function(event){
    tooltip
      .style("left", (event.clientX + 16) + "px")
      .style("top", (event.clientY - 20) + "px");
})
.on("mouseleave", function(){
    d3.selectAll("#mainChart .bar")
      .transition()
      .duration(150)
      .style("opacity", 1)
      .style("stroke", "none")
      .attr("transform", "translate(0,0)");

    tooltip.style("opacity", 0);
});
let actualChart;

async function drawGraph() {
  actualChart?.destroy();
  const data = await fetch("measurements.txt");
  const text = await data.text();

  const measurements = text.split("\n");
  measurements.pop();
  const finalData = measurements.map((measurement) => {
    const MB = parseInt(measurement) / 1000000;
    if (isNaN(MB)) return 0;
    return MB;
  });

  console.log(finalData);
  actualChart = new Chart(document.getElementById("lineChart"), {
    type: "line",
    options: {
      responsive: true,
    },
    data: {
      labels: finalData.map((_, i) => {
        return new Date(i * 5000).toISOString().slice(11, 19);
      }),
      datasets: [
        {
          label: "Memory used in MB",
          data: finalData,
          fill: false,
        },
      ],
    },
  });
}
drawGraph();
setInterval(drawGraph, 5000);

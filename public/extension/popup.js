document.addEventListener('DOMContentLoaded', async () => {
  const engineStatus = document.getElementById('engineStatus');
  const fleetStatus = document.getElementById('fleetStatus');

  try {
    const res = await fetch('http://localhost:3000/api/health');
    if (res.ok) {
      if (engineStatus) {
        engineStatus.textContent = '● Connected (Live)';
        engineStatus.style.color = '#34d399';
      }
    } else {
      if (engineStatus) {
        engineStatus.textContent = '● Idle / Disconnected';
        engineStatus.style.color = '#f87171';
      }
    }
  } catch (e) {
    if (engineStatus) {
      engineStatus.textContent = '● App Server Offline';
      engineStatus.style.color = '#f87171';
    }
  }
});

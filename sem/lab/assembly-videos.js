const search = document.querySelector('#video-search');
const stageFilter = document.querySelector('#stage-filter');
const priorityFilter = document.querySelector('#priority-filter');
const stages = [...document.querySelectorAll('.stage')];
function filterVideos() {
  const query = search.value.trim().toLowerCase();
  let videos = 0, visibleStages = 0;
  for (const stage of stages) {
    let count = 0;
    for (const card of stage.querySelectorAll('.video')) {
      const priority = priorityFilter.value;
      const matchesPriority = priority === 'all' || (priority === 'core' ? ['Core', 'Start here'].includes(card.dataset.priority) : card.dataset.priority === priority);
      const matchesStage = stageFilter.value === 'all' || stage.dataset.stage === stageFilter.value;
      card.hidden = !(matchesPriority && matchesStage && `${stage.querySelector('h2').textContent} ${card.textContent}`.toLowerCase().includes(query));
      if (!card.hidden) count++;
    }
    stage.hidden = count === 0;
    if (count) visibleStages++;
    videos += count;
  }
  document.querySelector('#result-count').textContent = `${videos} video${videos === 1 ? '' : 's'} across ${visibleStages} stage${visibleStages === 1 ? '' : 's'}`;
  document.querySelector('#empty-state').hidden = videos !== 0;
}
search.addEventListener('input', filterVideos);
stageFilter.addEventListener('change', filterVideos);
priorityFilter.addEventListener('change', filterVideos);

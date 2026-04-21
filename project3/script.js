const progressBar = document.getElementById('progress');

window.addEventListener('scroll', function() {
  const scrolled = window.scrollY;
  const totalHeight = document.body.scrollHeight - window.innerHeight;
  const percent = (scrolled / totalHeight) * 100;
  progressBar.style.width = percent + '%';
});

const revealObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(function(el) {
  revealObserver.observe(el);
});


const kitchenSection = document.getElementById('s1');
const fadeLayers = document.querySelectorAll('.fade-layer');

window.addEventListener('scroll', function() {
  const rect = kitchenSection.getBoundingClientRect();
  const windowHeight = window.innerHeight;

  // progress goes from 0 (section just entered view) to 1 (section almost gone)
  const progress = Math.max(0, Math.min(1,
    (windowHeight * 0.7 - rect.top) / (rect.height * 0.75)
  ));

  fadeLayers.forEach(function(layer) {
    const fadeAt = parseFloat(layer.dataset.fadeAt);

    if (progress < fadeAt) {
      layer.style.opacity = 1;
    } else {
      layer.style.opacity = Math.max(0, 1 - (progress - fadeAt) / 0.6);
    }
  });
});

const cardObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('card-visible');
    }
  });
}, { threshold: 0.3 });

const cardSection = document.getElementById('s2');
if (cardSection) {
  cardObserver.observe(cardSection);
}

const smellData = {
  light: {
    center: 'light',
    attempt: 0,
    text: 'The kitchen in the afternoon. That particular gold through the window. You didn\'t notice it then. You notice it now.'
  },
  vanilla: {
    center: 'vanilla',
    attempt: 1,
    text: 'One teaspoon. She kept it in a small brown bottle at the back of the cupboard. You still buy the same brand without thinking.'
  },
  caramel: {
    center: 'golden',
    attempt: 2,
    text: 'The edges where the batter caught the tin. She\'d let you have that part. You\'d eat it still warm, standing at the counter.'
  },
  lemon: {
    center: 'citrus',
    attempt: 3,
    text: 'Something bright you could never account for. It isn\'t in the recipe. Maybe she added it quietly, every time, without writing it down.'
  },
  savory: {
    center: 'savory',
    attempt: 4,
    text: 'The flour already measured before you woke up. The bowl already set out. She was always a step ahead of the morning.'
  },
  buttery: {
    center: 'buttery',
    attempt: 5,
    text: 'Rich and warm. The kind of thing that feels like being looked after. You haven\'t felt that in a while.'
  }
};

const centerLabel = document.getElementById('wheel-center-text');
const responseText = document.getElementById('wheel-response');
let activePetal = null;

function selectPetal(clickedPetal) {
  const allPetals = document.querySelectorAll('.petal');
  const key = clickedPetal.dataset.key;

  // if the same petal is clicked again, reset everything
  if (activePetal === clickedPetal) {
    clickedPetal.classList.remove('active');
    allPetals.forEach(function(p) {
      p.classList.remove('faded');
    });
    centerLabel.innerHTML = 'choose<br>a memory';
    responseText.classList.remove('visible');
    activePetal = null;
    return;
  }

  // set the new active petal
  activePetal = clickedPetal;

  // update each petal's state
  allPetals.forEach(function(p) {
    p.classList.remove('active', 'faded');
    if (p !== clickedPetal) {
      p.classList.add('faded');
    }
  });
  clickedPetal.classList.add('active');

  // update the center label
  centerLabel.textContent = smellData[key].center;

  // hide the old response text, then swap in the new one
  responseText.classList.remove('visible');
  setTimeout(function() {
    responseText.textContent = smellData[key].text;
    responseText.classList.add('visible');
  }, 160);

  // jump to the matching attempt layer in scene 4
  currentBowl = smellData[key].attempt;
  updateBowl();
}

const bowlLayers = document.querySelectorAll('.bowl-layer');
const prevButton = document.getElementById('btn-prev');
const nextButton = document.getElementById('btn-next');
const attemptCounter = document.getElementById('attempt-counter');
const dots = document.querySelectorAll('#dot-strip span');

const attemptLabels = [
  'attempt 1 — light',
  'attempt 2 — vanilla',
  'attempt 3 — caramel',
  'attempt 4 — lemon',
  'attempt 5 — savory',
  'attempt 6 — buttery'
];

let currentBowl = 0;

function updateBowl() {
  // show only the active layer
  bowlLayers.forEach(function(layer, i) {
    layer.classList.toggle('active', i === currentBowl);
  });

  // update the dot indicator
  dots.forEach(function(dot, i) {
    dot.classList.toggle('on', i === currentBowl);
  });

  // update the counter text
  attemptCounter.textContent = attemptLabels[currentBowl];

  // disable buttons at the ends
  prevButton.disabled = currentBowl === 0;
  nextButton.disabled = currentBowl === bowlLayers.length - 1;
}

function stepBowl(direction) {
  currentBowl = Math.max(0, Math.min(bowlLayers.length - 1, currentBowl + direction));
  updateBowl();
}


document.querySelector('.back-link').addEventListener('click', function() {
  // reset all petals
  document.querySelectorAll('.petal').forEach(function(p) {
    p.classList.remove('active', 'faded');
  });
  centerLabel.innerHTML = 'choose<br>a memory';
  responseText.classList.remove('visible');
  responseText.textContent = '';
  activePetal = null;

  // reset attempts to the first layer
  currentBowl = 0;
  updateBowl();
});

updateBowl();
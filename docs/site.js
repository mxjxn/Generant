const slides = [
  {src:'assets/generant-sequencer-tracker.png', title:'Sequencer / tracker', alt:'Generant tracker sequencer view'},
  {src:'assets/generant-instruments.png', title:'Rack / instruments', alt:'Generant instrument rack with device controls'},
  {src:'assets/generant-mixer.png', title:'Mixer / channel routing', alt:'Generant mixer with channel strips'},
  {src:'assets/generant-settings.png', title:'Settings / audio and MIDI', alt:'Generant audio and MIDI settings'},
  {src:'assets/generant-song.png', title:'Song mode / pattern arrangement', alt:'Generant song mode pattern arrangement'},
  {src:'assets/generant-osc-events.png', title:'OSC events / Blender output', alt:'Generant OSC event track'},
];

const carousel = document.querySelector('[data-carousel]');
if (carousel) {
  const image = carousel.querySelector('[data-carousel-image]');
  const title = carousel.querySelector('[data-carousel-title]');
  const count = carousel.querySelector('[data-carousel-count]');
  const thumbs = [...carousel.querySelectorAll('[data-slide]')];
  let index = 0;
  const show = (next) => {
    index = (next + slides.length) % slides.length;
    const slide = slides[index];
    image.src = slide.src;
    image.alt = slide.alt;
    title.textContent = slide.title;
    count.textContent = `${index + 1} / ${slides.length}`;
    thumbs.forEach((button, i) => {
      button.classList.toggle('active', i === index);
      button.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
  };
  carousel.querySelector('.previous').addEventListener('click', () => show(index - 1));
  carousel.querySelector('.next').addEventListener('click', () => show(index + 1));
  thumbs.forEach((button) => button.addEventListener('click', () => show(Number(button.dataset.slide))));
  carousel.querySelector('.screen-expand').addEventListener('click', async () => {
    if (image.requestFullscreen) await image.requestFullscreen();
    else window.open(image.src, '_blank', 'noopener');
  });
}

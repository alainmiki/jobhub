import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Profile Edit Browser Automation', () => {
  const html = `<!DOCTYPE html>
<html>
  <body>
    <div id="experience-container"></div>
    <button id="addExperienceBtn">Add Experience</button>
    <div id="education-container"></div>
    <button id="addEducationBtn">Add Education</button>
    <script>
      let expCount = 0;
      let eduCount = 0;

      function addExperience() {
        const container = document.getElementById('experience-container');
        const item = document.createElement('div');
        item.className = 'experience-item';
        item.innerHTML = `
          <button type="button" class="remove-btn">Remove</button>
          <input type="text" name="experience[\${expCount}][company]" value="" />
          <input type="text" name="experience[\${expCount}][title]" value="" />
        `;

        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          item.remove();
        });

        container.appendChild(item);
        expCount++;
      }

      function addEducation() {
        const container = document.getElementById('education-container');
        const item = document.createElement('div');
        item.className = 'education-item';
        item.innerHTML = `
          <button type="button" class="remove-btn">Remove</button>
          <input type="text" name="education[\${eduCount}][institution]" value="" />
          <input type="text" name="education[\${eduCount}][degree]" value="" />
        `;

        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          item.remove();
        });

        container.appendChild(item);
        eduCount++;
      }

      const addExperienceBtn = document.getElementById('addExperienceBtn');
      const addEducationBtn = document.getElementById('addEducationBtn');
      addExperienceBtn.addEventListener('click', (event) => {
        event.preventDefault();
        addExperience();
      });
      addEducationBtn.addEventListener('click', (event) => {
        event.preventDefault();
        addEducation();
      });

      window.addExperience = addExperience;
      window.addEducation = addEducation;
    </script>
  </body>
</html>`;

  it('should add and remove experience items', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { document, window } = dom.window;
    const addButton = document.getElementById('addExperienceBtn');

    addButton.click();
    expect(document.querySelectorAll('.experience-item').length).toBe(1);
    expect(document.querySelector('input[name="experience[0][company]"]')).not.toBeNull();
    expect(document.querySelector('input[name="experience[0][title]"]')).not.toBeNull();

    const removeButton = document.querySelector('.experience-item .remove-btn');
    removeButton.click();
    expect(document.querySelectorAll('.experience-item').length).toBe(0);
  });

  it('should add and remove education items', () => {
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { document } = dom.window;
    const addButton = document.getElementById('addEducationBtn');

    addButton.click();
    expect(document.querySelectorAll('.education-item').length).toBe(1);
    expect(document.querySelector('input[name="education[0][institution]"]')).not.toBeNull();
    expect(document.querySelector('input[name="education[0][degree]"]')).not.toBeNull();

    const removeButton = document.querySelector('.education-item .remove-btn');
    removeButton.click();
    expect(document.querySelectorAll('.education-item').length).toBe(0);
  });
});
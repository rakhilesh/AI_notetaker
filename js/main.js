document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- UI Elements ---
  const navIcons = document.querySelectorAll('.nav-icon');
  const views = document.querySelectorAll('.view');
  const noteEditor = document.getElementById('note-editor');
  const latexPreview = document.getElementById('latex-preview');
  const saveNoteBtn = document.getElementById('save-note');
  const summarizeBtn = document.getElementById('summarize-note');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveSettingsBtn = document.getElementById('save-settings');
  const linkList = document.getElementById('link-list');
  const templateList = document.getElementById('template-list');

  // --- Constants ---
  const TEMPLATES = [
    { 
      title: "🔬 AI Research Note", 
      content: "# AI Research: [Subject]\n\n## Objective\nAnalyze [Mechanism/Algorithm]\n\n## Key Hypotheses\n$ H_0: ... $\n\n## Findings\n- Observation 1\n- Observation 2\n\n## Mathematical Proof\n$$\n\\nabla J(\\theta) = ...\n$$\n" 
    },
    { 
      title: "🏗️ System Architecture", 
      content: "# Architecture: [Component Name]\n\n## Overview\nHigh-level description of the system.\n\n## Data Flow\n[Input] -> [Model] -> [Output]\n\n## Scalability Constraints\n- Latency: $ < 100ms $\n- Throughput: $ 10k \\text{ req/s} $\n" 
    },
    { 
      title: "✍️ Prompt Engineering Log", 
      content: "# Prompt Engineering: [Task]\n\n## Base Prompt\n\"...\"\n\n## Variations & Results\n1. Version A: [Result]\n2. Version B: [Result]\n\n## Optimal Configuration\n- Temperature: 0.7\n- Top-P: 0.9\n" 
    },
    {
      title: "📊 Model Evaluation",
      content: "# Evaluation: [Model Name]\n\n## Metrics\n- Accuracy: $ 94.2\\% $\n- F1-Score: $ 0.91 $\n\n## Error Analysis\nCommon failure modes identified.\n"
    }
  ];

  // --- State ---
  let currentNoteId = 'latest_note';

  // --- View Switching ---
  navIcons.forEach(icon => {
    icon.addEventListener('click', () => {
      const targetViewId = icon.id.replace('nav-', 'view-');
      
      // Update active nav
      navIcons.forEach(i => i.classList.remove('active'));
      icon.classList.add('active');

      // Update active view
      views.forEach(view => {
        view.style.display = view.id === targetViewId ? 'block' : 'none';
      });

      // Special handling for views
      if (targetViewId === 'view-links') loadLinks();
      if (targetViewId === 'view-templates') loadTemplates();
    });
  });

  // --- LaTeX Rendering ---
  const updatePreview = () => {
    const text = noteEditor.value;
    if (window.katex) {
      // Very basic regex-based LaTeX parser for this MVP
      // Replaces $...$ and $$...$$ with rendered divs/spans
      let htmlContent = text.replace(/\$\$(.*?)\$\$/gs, (match, p1) => {
        try {
          return `<div class="katex-block">${window.katex.renderToString(p1, { displayMode: true })}</div>`;
        } catch (e) { return match; }
      }).replace(/\$(.*?)\$/g, (match, p1) => {
        try {
          return window.katex.renderToString(p1, { displayMode: false });
        } catch (e) { return match; }
      });
      
      // Convert newlines to breaks for non-latex text
      latexPreview.innerHTML = htmlContent.replace(/\n/g, '<br>');
    }
  };

  noteEditor.addEventListener('input', updatePreview);

  // --- Storage Management ---
  const loadNote = () => {
    chrome.storage.local.get([currentNoteId], (result) => {
      if (result[currentNoteId]) {
        noteEditor.value = result[currentNoteId];
        updatePreview();
      }
    });
  };

  saveNoteBtn.addEventListener('click', () => {
    const note = noteEditor.value;
    chrome.storage.local.set({ [currentNoteId]: note }, () => {
      saveNoteBtn.textContent = 'Saved!';
      setTimeout(() => saveNoteBtn.textContent = 'Save Note', 2000);
    });
  });

  // --- OpenAI Integration ---
  summarizeBtn.addEventListener('click', async () => {
    const note = noteEditor.value;
    if (!note) return;

    chrome.storage.local.get(['openai_api_key'], async (result) => {
      const apiKey = result.openai_api_key;
      if (!apiKey) {
        alert('Please set your OpenAI API Key in Settings.');
        return;
      }

      summarizeBtn.textContent = 'Summarizing...';
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `Summarize the following note concisely:\n\n${note}` }]
          })
        });
        const data = await response.json();
        const summary = data.choices[0].message.content;
        noteEditor.value += `\n\n--- AI Summary ---\n${summary}`;
        updatePreview();
      } catch (error) {
        console.error(error);
        alert('Error communicating with OpenAI.');
      }
      summarizeBtn.textContent = 'AI Summarize';
    });
  });

  // --- Templates ---
  const loadTemplates = () => {
    templateList.innerHTML = '';
    TEMPLATES.forEach(tpl => {
      const div = document.createElement('div');
      div.className = 'glass-panel';
      div.style.padding = '10px; cursor: pointer;';
      div.textContent = tpl.title;
      div.onclick = () => {
        noteEditor.value = tpl.content;
        updatePreview();
        document.getElementById('nav-home').click();
      };
      templateList.appendChild(div);
    });
  };

  // --- Links ---
  const loadLinks = () => {
    chrome.storage.local.get(['stored_links'], (result) => {
      const links = result.stored_links || [];
      linkList.innerHTML = '';
      if (links.length === 0) {
        linkList.innerHTML = '<p style="color: var(--text-secondary);">No links stored yet.</p>';
      }
      links.forEach(link => {
        const div = document.createElement('div');
        div.className = 'glass-panel';
        div.style.padding = '10px; display: flex; flex-direction: column; gap: 5px;';
        div.innerHTML = `
          <a href="${link.url}" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 600; font-size: 13px;">${link.title || link.url}</a>
          <span style="font-size: 11px; color: var(--text-secondary);">${new Date(link.timestamp).toLocaleString()}</span>
        `;
        linkList.appendChild(div);
      });
    });
  };

  // --- Settings ---
  chrome.storage.local.get(['openai_api_key'], (result) => {
    if (result.openai_api_key) apiKeyInput.value = result.openai_api_key;
  });

  saveSettingsBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    chrome.storage.local.set({ 'openai_api_key': key }, () => {
      alert('Settings saved!');
    });
  });

  // Init load
  loadNote();
});

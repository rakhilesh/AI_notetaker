document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- UI Elements ---
  const navIcons = document.querySelectorAll('.nav-icon');
  const views = document.querySelectorAll('.view');
  const noteTitle = document.getElementById('note-title');
  const noteFolderSelect = document.getElementById('note-folder');
  const noteTags = document.getElementById('note-tags');
  const noteEditor = document.getElementById('note-editor');
  const aiTagBtn = document.getElementById('ai-tag-btn');
  const latexPreview = document.getElementById('latex-preview');
  const saveNoteBtn = document.getElementById('save-note');
  const summarizeBtn = document.getElementById('summarize-note');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveSettingsBtn = document.getElementById('save-settings');
  const linkList = document.getElementById('link-list');
  const templateList = document.getElementById('template-list');
  const libraryContent = document.getElementById('library-content');
  const newFolderBtn = document.getElementById('new-folder-btn');

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
      if (targetViewId === 'view-library') renderLibrary();
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
  const loadAppState = () => {
    chrome.storage.local.get(['all_notes', 'all_folders', 'latest_note'], (result) => {
      allNotes = result.all_notes || [];
      allFolders = result.all_folders || [{ id: 'general', name: 'General' }];
      
      // Migration from single note
      if (result.latest_note && allNotes.length === 0) {
        const migratedNote = {
          id: Date.now().toString(),
          title: 'Imported Note',
          content: result.latest_note,
          folderId: 'general',
          tags: [],
          timestamp: Date.now()
        };
        allNotes.push(migratedNote);
        chrome.storage.local.remove('latest_note');
        saveState();
      }

      updateFolderDropdown();
      renderLibrary();
      
      if (allNotes.length > 0) {
        loadNote(allNotes[0].id);
      }
    });
  };

  const saveState = () => {
    chrome.storage.local.set({ 
      all_notes: allNotes, 
      all_folders: allFolders 
    });
  };

  const updateFolderDropdown = () => {
    noteFolderSelect.innerHTML = allFolders.map(f => 
      `<option value="${f.id}">${f.name}</option>`
    ).join('');
  };

  const loadNote = (id) => {
    const note = allNotes.find(n => n.id === id);
    if (note) {
      currentNoteId = note.id;
      noteTitle.value = note.title || '';
      noteEditor.value = note.content || '';
      noteFolderSelect.value = note.folderId || 'general';
      noteTags.value = (note.tags || []).join(', ');
      updatePreview();
    }
  };

  saveNoteBtn.addEventListener('click', () => {
    const noteData = {
      id: currentNoteId || Date.now().toString(),
      title: noteTitle.value || 'Untitled',
      content: noteEditor.value,
      folderId: noteFolderSelect.value,
      tags: noteTags.value.split(',').map(t => t.trim()).filter(t => t),
      timestamp: Date.now()
    };

    const index = allNotes.findIndex(n => n.id === noteData.id);
    if (index > -1) {
      allNotes[index] = noteData;
    } else {
      allNotes.push(noteData);
      currentNoteId = noteData.id;
    }

    saveState();
    saveNoteBtn.textContent = 'Saved!';
    setTimeout(() => saveNoteBtn.textContent = 'Save Note', 2000);
    renderLibrary();
  });

  // --- AI Tag Generation ---
  aiTagBtn.addEventListener('click', async () => {
    const content = noteEditor.value;
    if (!content) return;

    chrome.storage.local.get(['openai_api_key'], async (result) => {
      const apiKey = result.openai_api_key;
      if (!apiKey) {
        alert('Please set your OpenAI API Key in Settings.');
        return;
      }

      aiTagBtn.textContent = 'Generating...';
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `Generate 3-5 concise one-word tags for this note content. Return ONLY the tags separated by commas:\n\n${content}` }]
          })
        });
        const data = await response.json();
        const tags = data.choices[0].message.content;
        noteTags.value = tags;
      } catch (error) {
        console.error(error);
        alert('Error generating tags.');
      }
      aiTagBtn.textContent = '✨ AI Tags';
    });
  });

  // --- Library Management ---
  const renderLibrary = () => {
    libraryContent.innerHTML = '';
    
    allFolders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.innerHTML = `<div style="font-weight: bold; margin-bottom: 5px; color: var(--accent-color); display: flex; align-items: center; gap: 5px;">
        <i data-lucide="folder" style="width: 14px;"></i> ${folder.name}
      </div>`;
      
      const noteContainer = document.createElement('div');
      noteContainer.style.marginLeft = '15px';
      noteContainer.style.marginBottom = '15px';
      
      const folderNotes = allNotes.filter(n => n.folderId === folder.id);
      if (folderNotes.length === 0) {
        noteContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-secondary);">Empty</div>';
      }
      
      folderNotes.forEach(note => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'glass-panel';
        noteDiv.style.padding = '8px; margin-bottom: 5px; cursor: pointer; font-size: 13px;';
        noteDiv.innerHTML = `<div style="display: flex; justify-content: space-between;">
          <span>${note.title}</span>
          <span style="font-size: 10px; color: var(--text-secondary);">${new Date(note.timestamp).toLocaleDateString()}</span>
        </div>
        <div style="margin-top: 5px;">
          ${(note.tags || []).map(t => `<span style="font-size: 10px; background: hsla(260, 80%, 65%, 0.1); padding: 2px 5px; border-radius: 4px; margin-right: 4px;">#${t}</span>`).join('')}
        </div>`;
        noteDiv.onclick = () => {
          loadNote(note.id);
          document.getElementById('nav-home').click();
        };
        noteContainer.appendChild(noteDiv);
      });
      
      libraryContent.appendChild(folderDiv);
      libraryContent.appendChild(noteContainer);
    });

    if (window.lucide) window.lucide.createIcons();
  };

  newFolderBtn.addEventListener('click', () => {
    const name = prompt('Folder Name:');
    if (name) {
      const newFolder = { id: Date.now().toString(), name: name };
      allFolders.push(newFolder);
      saveState();
      updateFolderDropdown();
      renderLibrary();
    }
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
  loadAppState();
});

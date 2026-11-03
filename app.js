const chatTab = document.querySelector('#chatTab');
const quizTab = document.querySelector('#quizTab');
const compareTab = document.querySelector('#compareTab');
const chatPanel = document.querySelector('#chatPanel');
const quizPanel = document.querySelector('#quizPanel');
const comparePanel = document.querySelector('#comparePanel');
const messages = document.querySelector('#chatMessages');
const input = document.querySelector('#userInput');
const statusNote = document.querySelector('#knowledgeStatus');
const quizContent = document.querySelector('#quizContent');
const programChecklist = document.querySelector('#programChecklist');
const comparisonResults = document.querySelector('#comparisonResults');
const compareSelectedButton = document.querySelector('#compareSelectedButton');
const compareSelectionCount = document.querySelector('#compareSelectionCount');
const MAX_COMPARE_PROGRAMS = 4;
const COMPARISON_LABEL_COLUMN_WIDTH = 160;
const COMPARISON_PROGRAM_COLUMN_WIDTH = 320;
const serviceStatus = document.querySelector('#serviceStatus');
const serviceStatusDot = document.querySelector('#serviceStatusDot');
const welcomeMessage = messages.querySelector('.message.bot').cloneNode(true);

let programs = [];
let knowledgeMarkdown = '';
let chatHistory = [];
let isSending = false;
let chatSessionId = 0;
let chatRequestController = null;
let selectedProgramNames = new Set();

async function loadKnowledge() {
  try {
    const response = await fetch('program-knowledge.md');
    if (!response.ok) throw new Error('Could not load program-knowledge.md');
    knowledgeMarkdown = await response.text();
    programs = parsePrograms(knowledgeMarkdown);
    if (programs.length !== 14) console.warn(`Expected 14 FAST programs; loaded ${programs.length}.`);
    if (programs.length < 2) throw new Error('The knowledge file needs at least two programs.');
    statusNote.textContent = '';
    setServiceStatus('ready', 'Ready to help');
    renderProgramChecklist();
    renderQuiz();
  } catch (error) {
    statusNote.textContent = 'Could not load program information. Open this page through a local web server and check that program-knowledge.md is beside it.';
    setServiceStatus('error', 'Unavailable');
    quizContent.textContent = 'The quiz needs the program information file to load first.';
  }
}

function parsePrograms(markdown) {
  return markdown.split(/^# Program Name:\s*/m).slice(1).map(section => {
    const [heading, ...lines] = section.split('\n');
    return {
      name: heading.trim(),
      credential: readProgramField(lines, 'Credential Level'),
      target: readProgramField(lines, 'Target Students'),
      curriculum: readProgramField(lines, 'Core Curriculum & Technical Skills'),
      highlights: readProgramField(lines, 'Key Program Highlights'),
      careers: readProgramField(lines, 'Career Paths & Job Titles')
    };
  });
}

function readProgramField(lines, label) {
  const fieldIndex = lines.findIndex(line => line.startsWith(`- **${label}**:`));
  if (fieldIndex < 0) return '';
  const firstValue = lines[fieldIndex].replace(`- **${label}**:`, '').trim();
  const values = firstValue ? [firstValue] : [];
  for (let index = fieldIndex + 1; index < lines.length && /^\s+- /.test(lines[index]); index++) {
    values.push(lines[index].replace(/^\s+- /, '').trim());
  }
  return values.join('; ');
}

function renderProgramChecklist() {
  programChecklist.replaceChildren();
  for (const program of programs) {
    const label = document.createElement('label');
    label.className = 'program-check-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = program.name;
    checkbox.checked = selectedProgramNames.has(program.name);
    checkbox.disabled = selectedProgramNames.size >= MAX_COMPARE_PROGRAMS && !checkbox.checked;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked && selectedProgramNames.size >= MAX_COMPARE_PROGRAMS) {
        checkbox.checked = false;
        compareSelectionCount.textContent = `You can compare up to ${MAX_COMPARE_PROGRAMS} programs.`;
        return;
      }
      if (checkbox.checked) selectedProgramNames.add(program.name);
      else selectedProgramNames.delete(program.name);
      comparisonResults.replaceChildren();
      updateCompareSelection();
    });
    const name = document.createElement('span');
    name.textContent = program.name;
    label.append(checkbox, name);
    programChecklist.append(label);
  }
  updateCompareSelection();
}

function updateCompareSelection() {
  const count = selectedProgramNames.size;
  programChecklist.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.disabled = count >= MAX_COMPARE_PROGRAMS && !checkbox.checked;
  });
  compareSelectionCount.textContent = count < 2
    ? `${count} selected · Select at least two programs.`
    : count === MAX_COMPARE_PROGRAMS
      ? `${count} programs selected · Maximum reached.`
      : `${count} programs selected.`;
  compareSelectedButton.disabled = count < 2;
}

function selectProgramsForComparison(names) {
  selectedProgramNames = new Set(names.filter(name => programs.some(program => program.name === name)));
  renderProgramChecklist();
  renderComparisonTable();
  switchMode('compare');
}

function renderComparisonTable() {
  const selected = programs.filter(program => selectedProgramNames.has(program.name));
  if (selected.length < 2) {
    comparisonResults.replaceChildren();
    return;
  }

  const fields = [
    ['Credential', 'credential'],
    ['Designed for', 'target'],
    ['Curriculum', 'curriculum'],
    ['Key highlights', 'highlights'],
    ['Career paths', 'careers']
  ];
  const wrapper = document.createElement('div');
  wrapper.className = 'comparison-table-wrap';
  const table = document.createElement('table');
  table.className = 'comparison-table';
  table.style.tableLayout = 'fixed';
  table.style.width = `${COMPARISON_LABEL_COLUMN_WIDTH + COMPARISON_PROGRAM_COLUMN_WIDTH * selected.length}px`;
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const detailHeader = document.createElement('th');
  detailHeader.scope = 'col';
  detailHeader.textContent = 'Program details';
  headerRow.append(detailHeader);
  for (const program of selected) {
    const header = document.createElement('th');
    header.scope = 'col';
    header.textContent = program.name;
    headerRow.append(header);
  }
  head.append(headerRow);
  const body = document.createElement('tbody');
  for (const [label, field] of fields) {
    const row = document.createElement('tr');
    const rowHeader = document.createElement('th');
    rowHeader.scope = 'row';
    rowHeader.textContent = label;
    row.append(rowHeader);
    for (const program of selected) {
      const cell = document.createElement('td');
      const items = formatComparisonItems(program[field], field);
      if (!items.length) items.push('Not listed in the program guide.');
      const list = document.createElement('ul');
      list.className = 'comparison-bullets';
      for (const item of items) {
        const bullet = document.createElement('li');
        bullet.textContent = item;
        list.append(bullet);
      }
      cell.append(list);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  wrapper.append(table);
  comparisonResults.replaceChildren(wrapper);
}

function formatComparisonItems(value, field) {
  if (!value) return [];
  let items = value.split(/;\s*/).map(item => item.trim()).filter(Boolean);
  if (field === 'target') {
    items = items.slice(0, 1).map(item => item.split(/(?<=[.!?])\s+/)[0]);
  }
  const maxLength = field === 'target' ? 170 : 145;
  return items.map(item => {
    if (item.length <= maxLength) return item;
    const shortened = item.slice(0, maxLength).replace(/\s+\S*$/, '').trimEnd();
    return `${shortened}…`;
  });
}

function switchMode(mode) {
  const chatActive = mode === 'chat';
  const quizActive = mode === 'quiz';
  chatTab.classList.toggle('is-active', chatActive);
  quizTab.classList.toggle('is-active', quizActive);
  compareTab.classList.toggle('is-active', mode === 'compare');
  chatTab.setAttribute('aria-selected', String(chatActive));
  quizTab.setAttribute('aria-selected', String(quizActive));
  compareTab.setAttribute('aria-selected', String(mode === 'compare'));
  chatPanel.hidden = !chatActive;
  quizPanel.hidden = !quizActive;
  comparePanel.hidden = mode !== 'compare';
}

function setServiceStatus(state, label) {
  serviceStatus.textContent = label;
  serviceStatusDot.classList.toggle('is-loading', state === 'loading');
  serviceStatusDot.classList.toggle('is-thinking', state === 'thinking');
  serviceStatusDot.classList.toggle('is-error', state === 'error');
}
chatTab.addEventListener('click', () => switchMode('chat'));
quizTab.addEventListener('click', () => switchMode('quiz'));
compareTab.addEventListener('click', () => switchMode('compare'));
messages.addEventListener('click', event => {
  if (!event.target.closest('#quizInlineLink')) return;
  event.preventDefault();
  switchMode('quiz');
  quizTab.focus();
});
document.querySelector('#resetChatButton').addEventListener('click', resetChat);
compareSelectedButton.addEventListener('click', renderComparisonTable);
document.querySelector('#clearCompareButton').addEventListener('click', () => {
  selectedProgramNames.clear();
  renderProgramChecklist();
  comparisonResults.replaceChildren();
});

document.querySelector('#chatForm').addEventListener('submit', event => {
  event.preventDefault();
  void sendChatMessage(input.value.trim());
});

async function sendChatMessage(question) {
  if (!question || isSending) return;
  const requestSessionId = chatSessionId;
  chatRequestController = new AbortController();
  addMessage(question, 'user');
  input.value = '';
  isSending = true;
  input.disabled = true;
  document.querySelector('#chatForm button').disabled = true;
  setServiceStatus('thinking', 'Thinking…');
  const loading = addTypingIndicator();
  try {
    const apiUrl = window.CHAT_API_URL;
    if (!apiUrl || apiUrl.includes('<your-worker>')) throw new Error('Set CHAT_API_URL in chat-config.js to your deployed chat service.');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        history: chatHistory.slice(-12),
        knowledge: knowledgeMarkdown
      }),
      signal: chatRequestController.signal
    });
    const result = await response.json().catch(() => ({}));
    if (requestSessionId !== chatSessionId) return;
    if (!response.ok) throw new Error(result.error || `Chat service returned ${response.status}.`);
    if (!result.answer) throw new Error('The chat service returned an empty response.');
    loading.textContent = result.answer;
    chatHistory.push({ role: 'user', text: question }, { role: 'model', text: result.answer });
    setServiceStatus('ready', 'Ready to help');
    statusNote.textContent = '';
  } catch (error) {
    if (requestSessionId !== chatSessionId || error.name === 'AbortError') return;
    loading.textContent = error.message.includes('Failed to fetch')
      ? 'I could not connect to the chat service. Check that the backend is running and its address is set in chat-config.js.'
      : error.message;
    statusNote.textContent = 'Chat service unavailable';
    setServiceStatus('error', 'Unavailable');
  } finally {
    if (requestSessionId === chatSessionId) {
      isSending = false;
      chatRequestController = null;
      input.disabled = false;
      document.querySelector('#chatForm button').disabled = false;
      input.focus();
    }
  }
}

function resetChat() {
  chatSessionId++;
  chatRequestController?.abort();
  chatRequestController = null;
  chatHistory = [];
  isSending = false;
  messages.replaceChildren(welcomeMessage.cloneNode(true));
  input.value = '';
  input.disabled = false;
  document.querySelector('#chatForm button').disabled = false;
  statusNote.textContent = '';
  setServiceStatus(programs.length ? 'ready' : 'error', programs.length ? 'Ready to help' : 'Unavailable');
  input.focus();
}

function addMessage(text, role) {
  const bubble = document.createElement('div');
  bubble.className = `message ${role}`;
  bubble.textContent = text;
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  const bubble = document.createElement('div');
  bubble.className = 'message bot typing-message';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-label', 'The assistant is thinking');
  bubble.innerHTML = '<span class="typing-label">Thinking</span><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

const firstQuizQuestion = {
  question: 'Which best describes you right now?',
  options: [
    'I’m in high school or just graduated.',
    'I have work experience and want to learn more.',
    'I’m exploring different fields.'
  ]
};
let quizQuestions = [firstQuizQuestion];
let quizAnswers = [];
let currentQuestion = 0;
let quizRecommendations = [];
let quizLoading = false;
let quizError = '';

async function requestQuizStep() {
  quizLoading = true;
  quizError = '';
  renderQuiz();
  try {
    const quizUrl = new URL(window.CHAT_API_URL);
    quizUrl.pathname = quizUrl.pathname.replace(/\/api\/chat\/?$/, '/api/quiz');
    const response = await fetch(quizUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: quizAnswers.map((answer, index) => ({ question: quizQuestions[index].question, answer })),
        knowledge: knowledgeMarkdown
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Quiz service returned ${response.status}.`);
    if (result.type === 'question' && result.question && Array.isArray(result.options) && result.options.length >= 2) {
      quizQuestions.push({ question: result.question, options: result.options });
      currentQuestion = quizQuestions.length - 1;
    } else if (result.type === 'recommendation' && Array.isArray(result.programs) && result.programs.length) {
      quizRecommendations = result.programs;
      currentQuestion = quizQuestions.length;
    } else {
      throw new Error('The quiz service returned an incomplete result. Please try again.');
    }
  } catch (error) {
    quizError = error.message.includes('Failed to fetch')
      ? 'Could not connect to the quiz service. Please check your connection and try again.'
      : error.message;
  } finally {
    quizLoading = false;
    renderQuiz();
  }
}

function resetQuiz() {
  quizQuestions = [firstQuizQuestion];
  quizAnswers = [];
  currentQuestion = 0;
  quizRecommendations = [];
  quizLoading = false;
  quizError = '';
  renderQuiz();
}

function renderQuiz() {
  const back = document.querySelector('#backButton');
  const restart = document.querySelector('#restartButton');
  const count = document.querySelector('#quizCount');
  const progress = document.querySelector('#progressBar');
  quizContent.replaceChildren();

  if (quizRecommendations.length) {
    count.textContent = 'Your recommendations';
    progress.style.width = '100%';
    back.hidden = true;
    restart.hidden = false;
    const card = document.createElement('div');
    card.className = 'result-card';
    const label = document.createElement('p');
    label.className = 'result-label';
    label.textContent = 'Based on your answers, explore these FAST programs';
    card.append(label);
    quizRecommendations.forEach((recommendation, index) => {
      const program = programs.find(item => item.name.toLowerCase() === recommendation.name.toLowerCase());
      if (!program) return;
      const heading = document.createElement('h3');
      heading.textContent = `${index + 1}. ${program.name}`;
      card.append(heading);
      const reason = document.createElement('p');
      reason.textContent = recommendation.reason;
      card.append(reason);
      const details = document.createElement('p');
      const credentialLabel = document.createElement('strong');
      credentialLabel.textContent = 'Credential: ';
      const careersLabel = document.createElement('strong');
      careersLabel.textContent = 'Career paths: ';
      details.append(credentialLabel, document.createTextNode(program.credential), document.createElement('br'), careersLabel, document.createTextNode(program.careers));
      card.append(details);
      const learnMore = document.createElement('button');
      learnMore.className = 'text-button learn-more-button';
      learnMore.type = 'button';
      learnMore.textContent = 'Learn more about this program';
      learnMore.addEventListener('click', () => {
        switchMode('chat');
        void sendChatMessage(`Tell me more about the ${program.name} program, including its curriculum, key highlights, and career paths.`);
      });
      card.append(learnMore);
    });
    if (quizRecommendations.length > 1) {
      const compareRecommendations = document.createElement('button');
      compareRecommendations.className = 'primary-button compare-recommendations-button';
      compareRecommendations.type = 'button';
      compareRecommendations.textContent = 'Compare my recommendations';
      compareRecommendations.addEventListener('click', () => {
        selectProgramsForComparison(quizRecommendations.map(item => item.name));
      });
      card.append(compareRecommendations);
    }
    quizContent.append(card);
    return;
  }

  const question = quizQuestions[currentQuestion];
  count.textContent = `Question ${currentQuestion + 1} · Adaptive quiz`;
  progress.style.width = `${Math.min(95, ((currentQuestion + 1) / 7) * 100)}%`;
  progress.classList.toggle('is-loading', quizLoading);
  back.hidden = currentQuestion === 0 || quizLoading;
  restart.hidden = true;

  if (quizLoading) {
    const waiting = document.createElement('div');
    waiting.className = 'quiz-thinking';
    waiting.setAttribute('role', 'status');
    waiting.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('span');
    spinner.className = 'quiz-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    const heading = document.createElement('p');
    heading.className = 'quiz-thinking-title';
    heading.textContent = 'Thinking through your answers';
    const detail = document.createElement('p');
    detail.className = 'quiz-thinking-detail';
    detail.textContent = 'Finding a useful next question or program match…';
    copy.append(heading, detail);
    waiting.append(spinner, copy);
    quizContent.append(waiting);
    return;
  }
  if (quizError) {
    const error = document.createElement('p');
    error.className = 'quiz-question';
    error.textContent = quizError;
    const retry = document.createElement('button');
    retry.className = 'primary-button';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', requestQuizStep);
    quizContent.append(error, retry);
    return;
  }
  if (!question) return;
  const prompt = document.createElement('h3');
  prompt.className = 'quiz-question';
  prompt.textContent = question.question;
  const list = document.createElement('div');
  list.className = 'answer-list';
  question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `answer-option${quizAnswers[currentQuestion] === option ? ' selected' : ''}`;
    button.textContent = option;
    button.addEventListener('click', () => {
      quizAnswers[currentQuestion] = option;
      quizQuestions = quizQuestions.slice(0, currentQuestion + 1);
      quizAnswers = quizAnswers.slice(0, currentQuestion + 1);
      quizRecommendations = [];
      requestQuizStep();
    });
    list.append(button);
  });
  quizContent.append(prompt, list);
}

document.querySelector('#backButton').addEventListener('click', () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    quizQuestions = quizQuestions.slice(0, currentQuestion + 1);
    quizAnswers = quizAnswers.slice(0, currentQuestion);
    quizRecommendations = [];
    quizError = '';
    renderQuiz();
  }
});
document.querySelector('#restartButton').addEventListener('click', resetQuiz);
loadKnowledge();

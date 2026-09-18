import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'language-lens-dictionary'
const THEME_KEY = 'language-lens-theme'

const initialDictionary = {
  English: [],
  Spanish: [],
  French: [],
  Korean: [],
}

const defaultWordTypes = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'greeting',
  'phrase',
]

const commonLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Arabic',
  'Russian',
  'Chinese',
  'Hindi',
]

const libreTranslateEndpoint = 'https://libretranslate.com/translate'
const libreTranslateApiKey = import.meta.env.VITE_LIBRETRANSLATE_API_KEY
const languageCodes = {
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Japanese: 'ja',
  Korean: 'ko',
  Arabic: 'ar',
  Russian: 'ru',
  Chinese: 'zh',
  Hindi: 'hi',
}

const formatWordType = (value) => {
  if (!value) {
    return ''
  }

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const romanizeKorean = (value) => {
  const initials = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
  const vowels = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
  const finals = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 'ng', 't', 't', 'k', 't', 'p', 'h']

  return [...value].map((character) => {
    const code = character.charCodeAt(0) - 0xac00
    if (code < 0 || code > 11171) return character

    const initialIndex = Math.floor(code / 588)
    const vowelIndex = Math.floor((code % 588) / 28)
    const finalIndex = code % 28
    return `${initials[initialIndex]}${vowels[vowelIndex]}${finals[finalIndex]}`
  }).join('')
}

const emptyForm = {
  word: '',
  translation: '',
  definition: '',
  pronunciation: '',
  automaticPronunciation: '',
  romanization: '',
  wordType: '',
  example: '',
  favorite: false,
}

const getStoredDictionary = () => {
  if (typeof window === 'undefined') {
    return initialDictionary
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return initialDictionary
    }

    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      return parsed
    }
  } catch (error) {
    console.error('Unable to parse saved dictionary', error)
  }

  return initialDictionary
}

function App() {
  const fileInputRef = useRef(null)
  const languageDropdownRef = useRef(null)
  const touchStartYRef = useRef(null)
  const [languages, setLanguages] = useState(getStoredDictionary)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState(emptyForm)
  const [customWordTypes, setCustomWordTypes] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [isLookingUpWord, setIsLookingUpWord] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [draggedLanguage, setDraggedLanguage] = useState(null)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [studyMode, setStudyMode] = useState(false)
  const [studyIndex, setStudyIndex] = useState(0)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme) {
      return storedTheme === 'dark'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [activeTab, setActiveTab] = useState('browse')
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(languages))
  }, [languages])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!languages[selectedLanguage]) {
      const firstLanguage = Object.keys(languages)[0]
      if (firstLanguage) {
        setSelectedLanguage(firstLanguage)
      }
    }
  }, [languages, selectedLanguage])

  useEffect(() => {
    setRevealAnswer(false)
  }, [selectedLanguage, studyMode])

  useEffect(() => {
    if (!quickAddOpen) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      document.getElementById('entry-word-input')?.focus()
    }, 120)

    return () => window.clearTimeout(timer)
  }, [quickAddOpen])

  useEffect(() => {
    if (!languageMenuOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      if (!languageDropdownRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [languageMenuOpen])

  const availableLanguages = Object.keys(languages)

  const currentEntries = languages[selectedLanguage] || []
  const wordTypeOptions = [...defaultWordTypes, ...customWordTypes]

  const favoriteEntries = useMemo(
    () => currentEntries.filter((entry) => entry.favorite),
    [currentEntries],
  )

  const studyEntries = useMemo(
    () => (favoriteEntries.length > 0 ? favoriteEntries : currentEntries),
    [currentEntries, favoriteEntries],
  )

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const entries = activeTab === 'favorites' ? currentEntries.filter((entry) => entry.favorite) : currentEntries

    if (!query) {
      return entries
    }

    return entries.filter((entry) =>
      [entry.word, entry.translation, entry.definition, entry.pronunciation, entry.automaticPronunciation, entry.romanization, entry.example]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [activeTab, currentEntries, searchTerm])

  const currentStudyCard = studyEntries[studyIndex % Math.max(studyEntries.length, 1)] || null

  const resetForm = () => {
    setFormData(emptyForm)
    setEditingEntryId(null)
  }

  const applyDictionaryResult = (result) => {
    const meaning = result.meanings?.[0]
    const definition = meaning?.definitions?.[0]
    const phonetic = result.phonetic || result.phonetics?.find((item) => item.text)?.text || ''

    setFormData((current) => ({
      ...current,
      word: result.word || current.word,
      definition: definition?.definition || current.definition,
      wordType: formatWordType(meaning?.partOfSpeech || current.wordType),
      automaticPronunciation: phonetic,
    }))
  }

  const lookupWord = async (word) => {
    const cleanedWord = word.trim()
    if (!cleanedWord || selectedLanguage !== 'English') return

    setIsLookingUpWord(true)
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanedWord)}`)
      if (response.ok) {
        const results = await response.json()
        applyDictionaryResult(results[0])
      }
    } catch (error) {
      console.warn('Dictionary lookup unavailable', error)
    } finally {
      setIsLookingUpWord(false)
    }
  }

  const translateWord = async () => {
    const word = formData.word.trim()
    const targetLanguage = languageCodes[selectedLanguage]
    if (!word || !targetLanguage || targetLanguage === 'en') return

    setIsTranslating(true)
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: word, source: targetLanguage, target: 'en', format: 'text' }),
      })

      if (!response.ok) {
        throw new Error(`Translation failed with status ${response.status}`)
      }

      const result = await response.json()
      const translatedText = result.translatedText
      if (translatedText) {
        setFormData((current) => ({ ...current, translation: translatedText }))
      }
    } catch (error) {
      console.warn('Translation proxy unavailable', error)
    } finally {
      setIsTranslating(false)
    }
  }

  const speakWord = (word, language) => {
    if (!('speechSynthesis' in window) || !word) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = languageCodes[language] || 'en'
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    const cleanedWord = formData.word.trim()
    if (!cleanedWord || selectedLanguage !== 'English' || editingEntryId !== null) {
      setSuggestions([])
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(cleanedWord)}*&max=6`, {
          signal: controller.signal,
        })
        if (response.ok) {
          const results = await response.json()
          setSuggestions(results.map((result) => result.word).filter(Boolean))
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.warn('Autocomplete unavailable', error)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [editingEntryId, formData.word, selectedLanguage])

  const handleLanguageSelect = (nextValue) => {
    if (nextValue === '__add_new__') {
      const customLanguage = window.prompt('Enter a new language name:')
      if (!customLanguage) {
        return
      }

      const normalizedName = customLanguage
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')

      if (!normalizedName) return

      if (!languages[normalizedName]) {
        setLanguages((current) => ({
          ...current,
          [normalizedName]: [],
        }))
      }

      setSelectedLanguage(normalizedName)
      setLanguageMenuOpen(false)
      return
    }

    setSelectedLanguage(nextValue)
  }

  const handleLanguageDrop = (targetLanguage) => {
    if (!draggedLanguage || draggedLanguage === targetLanguage) {
      return
    }

    const reorderedLanguages = availableLanguages.filter((language) => language !== draggedLanguage)
    const targetIndex = reorderedLanguages.indexOf(targetLanguage)
    reorderedLanguages.splice(targetIndex, 0, draggedLanguage)

    setLanguages((current) =>
      Object.fromEntries(reorderedLanguages.map((language) => [language, current[language]])),
    )
    setDraggedLanguage(null)
  }

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target

    if (name === 'word') {
      setFormData((current) => ({
        ...current,
        word: value,
        romanization: selectedLanguage === 'Korean' ? romanizeKorean(value) : current.romanization,
      }))
      return
    }

    if (name === 'wordType' && value === '__add_new__') {
      const customWordType = window.prompt('Enter a new word type:')
      const formattedWordType = formatWordType(customWordType || '')

      if (formattedWordType) {
        setCustomWordTypes((current) =>
          current.includes(formattedWordType) ? current : [...current, formattedWordType],
        )
        setFormData((current) => ({ ...current, wordType: formattedWordType }))
      }

      return
    }

    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const normalizedEntry = {
      ...formData,
      word: formData.word.trim(),
      translation: formData.translation.trim(),
      definition: formData.definition.trim(),
      pronunciation: formData.pronunciation.trim(),
      automaticPronunciation: formData.automaticPronunciation.trim(),
      romanization: formData.romanization.trim(),
      example: formData.example.trim(),
      wordType: formData.wordType,
      favorite: Boolean(formData.favorite),
    }

    if (!normalizedEntry.word || !normalizedEntry.translation || !normalizedEntry.definition || !normalizedEntry.example) {
      return
    }

    setLanguages((current) => {
      const currentEntriesForLanguage = current[selectedLanguage] || []

      const nextEntries =
        editingEntryId === null
          ? [{ id: Date.now(), ...normalizedEntry }, ...currentEntriesForLanguage]
          : currentEntriesForLanguage.map((entry) =>
              entry.id === editingEntryId ? { ...entry, ...normalizedEntry } : entry,
            )

      return {
        ...current,
        [selectedLanguage]: nextEntries,
      }
    })

    setQuickAddOpen(false)
    resetForm()
  }

  const handleEdit = (entry) => {
    setQuickAddOpen(true)
    setEditingEntryId(entry.id)
    setFormData({
      word: entry.word,
      translation: entry.translation,
      definition: entry.definition,
      pronunciation: entry.pronunciation,
      automaticPronunciation: entry.automaticPronunciation || '',
      romanization: entry.romanization || '',
      wordType: entry.wordType,
      example: entry.example,
      favorite: Boolean(entry.favorite),
    })
  }

  const handleDelete = (entryId) => {
    setLanguages((current) => ({
      ...current,
      [selectedLanguage]: (current[selectedLanguage] || []).filter((entry) => entry.id !== entryId),
    }))

    if (editingEntryId === entryId) {
      resetForm()
    }
  }

  const toggleFavorite = (entryId) => {
    setLanguages((current) => ({
      ...current,
      [selectedLanguage]: (current[selectedLanguage] || []).map((entry) =>
        entry.id === entryId ? { ...entry, favorite: !entry.favorite } : entry,
      ),
    }))
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(languages, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dictionary-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const importedText = await file.text()
      const parsedData = JSON.parse(importedText)

      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Invalid dictionary file.')
      }

      const normalized = Object.fromEntries(
        Object.entries(parsedData)
          .filter(([language]) => typeof language === 'string' && language.trim())
          .map(([language, entries]) => [
            language,
            Array.isArray(entries)
              ? entries
                  .filter((entry) => entry && typeof entry === 'object' && typeof entry.word === 'string')
                  .map((entry) => ({
                    ...entry,
                    id: Number(entry.id) || Date.now() + Math.random(),
                    word: entry.word.trim(),
                    translation: typeof entry.translation === 'string' ? entry.translation : '',
                    definition: typeof entry.definition === 'string' ? entry.definition : '',
                    pronunciation: typeof entry.pronunciation === 'string' ? entry.pronunciation : '',
                    automaticPronunciation: typeof entry.automaticPronunciation === 'string' ? entry.automaticPronunciation : '',
                    romanization: typeof entry.romanization === 'string' ? entry.romanization : '',
                    example: typeof entry.example === 'string' ? entry.example : '',
                    favorite: Boolean(entry.favorite),
                  }))
              : [],
          ]),
      )

      setLanguages(normalized)
      if (Object.keys(normalized).length > 0) {
        setSelectedLanguage(Object.keys(normalized)[0])
      }
    } catch (error) {
      console.error('Import failed', error)
      window.alert('Unable to import that file. Please use a valid dictionary export JSON.')
    } finally {
      event.target.value = ''
    }
  }

  const isDesktop = typeof window !== 'undefined' ? window.innerWidth > 900 : true

  const handleTouchStart = (event) => {
    if (window.scrollY > 0) {
      return
    }

    touchStartYRef.current = event.touches[0].clientY
  }

  const handleTouchMove = (event) => {
    if (touchStartYRef.current === null || window.scrollY > 0) {
      return
    }

    const delta = event.touches[0].clientY - touchStartYRef.current
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.6, 120))
    }
  }

  const handleTouchEnd = () => {
    if (pullDistance > 70) {
      setIsRefreshing(true)
      setSearchTerm('')
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 700)
    } else {
      setPullDistance(0)
    }

    touchStartYRef.current = null
  }

  return (
    <div className="app-shell" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Dictionary studio</p>
          <h1>Language Lens</h1>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <span>Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder=""
            />
          </label>

          <div className="language-field">
            <span>Language</span>
            <div className="language-dropdown" ref={languageDropdownRef}>
              <button
                type="button"
                className="language-dropdown-trigger"
                aria-expanded={languageMenuOpen}
                onClick={() => setLanguageMenuOpen((current) => !current)}
              >
                <span>{selectedLanguage}</span>
                <span aria-hidden="true">{languageMenuOpen ? '\u25b2' : '\u25bc'}</span>
              </button>
              {languageMenuOpen && (
                <div className="language-order-list" role="listbox" aria-label="Reorder languages">
                  {availableLanguages.map((language) => (
                    <button
                      key={language}
                      type="button"
                      className={`language-order-item ${language === selectedLanguage ? 'is-selected' : ''}`}
                      draggable
                      onClick={() => handleLanguageSelect(language)}
                      onDragStart={() => setDraggedLanguage(language)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleLanguageDrop(language)}
                      onDragEnd={() => setDraggedLanguage(null)}
                    >
                      <span aria-hidden="true">&#8942;&#8942;</span>
                      {language}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="language-order-item add-language-item"
                    onClick={() => handleLanguageSelect('__add_new__')}
                  >
                    + Add new language
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setDarkMode((current) => !current)}
          >
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </header>

      <nav className="quick-actions" aria-label="Quick actions">
        <button type="button" className={studyMode ? 'is-active' : ''} onClick={() => setStudyMode((current) => !current)}>
          Flashcards
        </button>
        <button type="button" onClick={handleExport}>
          Export JSON
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />
      </nav>

      <div className={`pull-indicator ${isRefreshing ? 'refreshing' : ''}`} style={{ height: `${Math.max(pullDistance, 0)}px` }}>
        <span>{isRefreshing ? 'Refreshing...' : pullDistance > 70 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>

      <main className="content">
        {(quickAddOpen || isDesktop) && (
          <aside className="panel form-panel">
            <div className="section-head">
              <h2>{editingEntryId !== null ? 'Edit word' : 'Add a new word'}</h2>
            </div>

            <form className="entry-form" onSubmit={handleSubmit}>
              <label>
                <span>New Term</span>
                <input
                  id="entry-word-input"
                  type="text"
                  name="word"
                  value={formData.word}
                  onChange={handleFormChange}
                  onBlur={() => lookupWord(formData.word)}
                  placeholder=""
                />
                {suggestions.length > 0 && (
                  <div className="word-suggestions" role="listbox" aria-label="Word suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setFormData((current) => ({ ...current, word: suggestion }))
                          setSuggestions([])
                          lookupWord(suggestion)
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {isLookingUpWord && <span className="lookup-status">Looking up definition...</span>}
              </label>

              <label>
                <span>Translation</span>
                <div className="translation-input-row">
                  <input
                    type="text"
                    name="translation"
                    value={formData.translation}
                    onChange={handleFormChange}
                    placeholder=""
                  />
                  <button
                    type="button"
                    className="inline-action-button"
                    onClick={translateWord}
                    disabled={isTranslating || !languageCodes[selectedLanguage] || selectedLanguage === 'English'}
                  >
                    {isTranslating ? '...' : 'Translate'}
                  </button>
                </div>
              </label>

              <label>
                <span>Definition</span>
                <textarea
                  name="definition"
                  value={formData.definition}
                  onChange={handleFormChange}
                  placeholder=""
                  rows="3"
                />
              </label>

              <label>
                <span>Your Pronunciation</span>
                <input
                  type="text"
                  name="pronunciation"
                  value={formData.pronunciation}
                  onChange={handleFormChange}
                  placeholder=""
                />
              </label>

              <label>
                <span>Automatic Pronunciation</span>
                <div className="translation-input-row">
                  <input
                    type="text"
                    value={formData.automaticPronunciation}
                    readOnly
                    placeholder="Generated after lookup"
                  />
                  <button
                    type="button"
                    className="inline-action-button"
                    onClick={() => speakWord(formData.word, selectedLanguage)}
                    disabled={!formData.word}
                    aria-label="Play pronunciation"
                  >
                    Play
                  </button>
                </div>
              </label>

              {selectedLanguage === 'Korean' && formData.romanization && (
                <label>
                  <span>Romanization</span>
                  <input type="text" value={formData.romanization} readOnly />
                </label>
              )}

              <label>
                <span>Word Type</span>
                <select
                  name="wordType"
                  value={formData.wordType}
                  onChange={handleFormChange}
                >
                  <option value="">Select a word type</option>
                  {wordTypeOptions.map((type) => (
                    <option key={type} value={formatWordType(type)}>
                      {formatWordType(type)}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add new word type</option>
                </select>
              </label>

              <label>
                <span>Example</span>
                <textarea
                  name="example"
                  value={formData.example}
                  onChange={handleFormChange}
                  placeholder=""
                  rows="3"
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="favorite"
                  checked={formData.favorite}
                  onChange={handleFormChange}
                />
                <span>Save as favorite for flashcards</span>
              </label>

              <div className="form-actions">
                <button className="submit-button" type="submit">
                  {editingEntryId !== null ? 'Update entry' : 'Save entry'}
                </button>
                {editingEntryId !== null && (
                  <button type="button" className="cancel-button" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </aside>
        )}

        <section className="panel entries-panel">
          <div className="section-head">
            <h2>{selectedLanguage} Library</h2>
            <span>{filteredEntries.length} results</span>
          </div>

          {studyMode && currentStudyCard && (
            <div className="study-card">
              <div className="study-header">
                <span className="study-badge">Flashcard</span>
                <span>
                  {studyIndex + 1}/{studyEntries.length}
                </span>
              </div>

              <h3>{currentStudyCard.word}</h3>
              <p className="study-type">{currentStudyCard.wordType}</p>

              {revealAnswer ? (
                <>
                  <p className="translation">{currentStudyCard.translation}</p>
                  <dl>
                    <div>
                      <dt>Definition</dt>
                      <dd>{currentStudyCard.definition}</dd>
                    </div>
                    <div>
                      <dt>Pronunciation</dt>
                      <dd>
                        {currentStudyCard.automaticPronunciation || currentStudyCard.pronunciation || 'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt>Example</dt>
                      <dd>{currentStudyCard.example}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="study-hint">Reveal the meaning and example.</p>
              )}

              <div className="study-actions">
                <button type="button" onClick={() => setRevealAnswer((current) => !current)}>
                  {revealAnswer ? 'Hide answer' : 'Reveal answer'}
                </button>
                <button type="button" className="secondary-button" onClick={() => setStudyIndex((current) => (current + 1) % studyEntries.length)}>
                  Next word
                </button>
              </div>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              <p>No matching terms in this language library yet.</p>
            </div>
          ) : (
            <div className="entries-list">
              {filteredEntries.map((entry) => (
                <article key={entry.id} className="entry-card">
                  <div className="entry-header">
                    <h3>{entry.word}</h3>
                    <div className="entry-tools">
                      <button
                        type="button"
                        className={`favorite-toggle ${entry.favorite ? 'is-favorite' : ''}`}
                        onClick={() => toggleFavorite(entry.id)}
                        aria-label={entry.favorite ? 'Remove favorite' : 'Add favorite'}
                      >
                        {entry.favorite ? '★' : '☆'}
                      </button>
                      <span className="pill">{entry.wordType}</span>
                    </div>
                  </div>

                  <p className="translation">{entry.translation}</p>

                  <dl>
                    <div>
                      <dt>Definition</dt>
                      <dd>{entry.definition}</dd>
                    </div>
                    <div>
                      <dt>Pronunciation</dt>
                      <dd>
                        {entry.automaticPronunciation && <span>{entry.automaticPronunciation} </span>}
                        {entry.pronunciation && <span>({entry.pronunciation})</span>}
                        {!entry.automaticPronunciation && !entry.pronunciation && 'Not provided'}
                        <button
                          type="button"
                          className="speak-button"
                          onClick={() => speakWord(entry.word, selectedLanguage)}
                          aria-label={`Play pronunciation for ${entry.word}`}
                        >
                          Play
                        </button>
                      </dd>
                    </div>
                    {entry.romanization && (
                      <div>
                        <dt>Romanization</dt>
                        <dd>{entry.romanization}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Example</dt>
                      <dd>{entry.example}</dd>
                    </div>
                  </dl>

                  <div className="entry-actions">
                    <button type="button" className="small-button edit-button" onClick={() => handleEdit(entry)}>
                      Edit
                    </button>
                    <button type="button" className="small-button delete-button" onClick={() => handleDelete(entry.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="bottom-nav">
        <button type="button" className={activeTab === 'browse' ? 'is-active' : ''} onClick={() => setActiveTab('browse')}>
          Browse
        </button>
        <button type="button" className={activeTab === 'favorites' ? 'is-active' : ''} onClick={() => setActiveTab('favorites')}>
          Favorites
        </button>
        <button type="button" className={activeTab === 'study' ? 'is-active' : ''} onClick={() => { setActiveTab('study'); setStudyMode(true) }}>
          Flashcards
        </button>
      </div>

      <button type="button" className="floating-add-button" onClick={() => { setQuickAddOpen(true); document.getElementById('entry-word-input')?.focus() }}>
        +
      </button>
    </div>
  )
}

export default App

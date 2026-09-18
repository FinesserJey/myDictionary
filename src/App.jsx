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
  voiceRecording: '',
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
  const libraryMenuRef = useRef(null)
  const settingsRef = useRef(null)
  const touchStartYRef = useRef(null)
  const [languages, setLanguages] = useState(getStoredDictionary)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWordType, setSelectedWordType] = useState('')
  const [formData, setFormData] = useState(emptyForm)
  const [customWordTypes, setCustomWordTypes] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [isLookingUpWord, setIsLookingUpWord] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const mediaRecorderRef = useRef(null)
  const recordingStreamRef = useRef(null)
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = useState([])

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
    setSelectedEntryIds([])
    setSelectionMode(false)
    setOpenEntryMenuId(null)
  }, [selectedLanguage])

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
      if (!libraryMenuRef.current?.contains(event.target)) {
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [languageMenuOpen])

  useEffect(() => {
    if (!settingsOpen) {
      return undefined
    }

    const handleOutsideClick = (event) => {
      if (!settingsRef.current?.contains(event.target)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [settingsOpen])

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
    const groupedEntries = selectedWordType ? entries.filter((entry) => entry.wordType === selectedWordType) : entries

    if (!query) {
      return groupedEntries
    }

    return groupedEntries.filter((entry) =>
      [entry.word, entry.translation, entry.definition, entry.pronunciation, entry.automaticPronunciation, entry.romanization, entry.example]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [activeTab, currentEntries, searchTerm, selectedWordType])

  const currentStudyCard = studyEntries[studyIndex % Math.max(studyEntries.length, 1)] || null

  const resetForm = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaRecorderRef.current = null
    recordingStreamRef.current = null
    setIsRecording(false)
    setRecordingError('')
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

  const toggleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Voice recording is not supported in this browser.')
      return
    }

    try {
      setRecordingError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setFormData((current) => ({ ...current, voiceRecording: reader.result }))
        }
        reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        stream.getTracks().forEach((track) => track.stop())
        mediaRecorderRef.current = null
        recordingStreamRef.current = null
        setIsRecording(false)
      }

      mediaRecorderRef.current = recorder
      recordingStreamRef.current = stream
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      setRecordingError(error.name === 'NotAllowedError' ? 'Microphone access was denied.' : 'Unable to start recording.')
    }
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
    setLanguageMenuOpen(false)
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

  const moveLanguage = (language, direction) => {
    const currentIndex = availableLanguages.indexOf(language)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= availableLanguages.length) return

    const reorderedLanguages = [...availableLanguages]
    const [movedLanguage] = reorderedLanguages.splice(currentIndex, 1)
    reorderedLanguages.splice(targetIndex, 0, movedLanguage)
    setLanguages((current) => Object.fromEntries(
      reorderedLanguages.map((item) => [item, current[item]]),
    ))
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
      voiceRecording: formData.voiceRecording,
      automaticPronunciation: formData.automaticPronunciation.trim(),
      romanization: formData.romanization.trim(),
      example: formData.example.trim(),
      wordType: formData.wordType,
      favorite: Boolean(formData.favorite),
    }

    if (!normalizedEntry.word) {
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
      voiceRecording: entry.voiceRecording || '',
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

    setOpenEntryMenuId(null)
  }

  const toggleEntrySelection = (entryId) => {
    setSelectedEntryIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
    )
  }

  const handleDeleteSelected = () => {
    if (selectedEntryIds.length === 0) return

    const confirmed = window.confirm(`Delete ${selectedEntryIds.length} selected ${selectedEntryIds.length === 1 ? 'word' : 'words'}?`)
    if (!confirmed) return

    setLanguages((current) => ({
      ...current,
      [selectedLanguage]: (current[selectedLanguage] || []).filter((entry) => !selectedEntryIds.includes(entry.id)),
    }))
    if (editingEntryId !== null && selectedEntryIds.includes(editingEntryId)) {
      resetForm()
    }
    setSelectedEntryIds([])
    setSelectionMode(false)
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
                    voiceRecording: typeof entry.voiceRecording === 'string' ? entry.voiceRecording : '',
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

        </div>
        <button
          type="button"
          className="theme-icon-button"
          onClick={() => setDarkMode((current) => !current)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{darkMode ? '\u2600' : '\u263e'}</span>
        </button>
        <div className="mobile-settings" ref={settingsRef}>
          <button
            type="button"
            className="settings-button"
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((current) => !current)}
          >
            <span aria-hidden="true">&#9776;</span>
          </button>
          {settingsOpen && (
            <div className="settings-menu">
              <button type="button" onClick={handleExport}>Export JSON</button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
            </div>
          )}
        </div>
      </header>

      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImport} />

      <div className={`pull-indicator ${isRefreshing ? 'refreshing' : ''}`} style={{ height: `${Math.max(pullDistance, 0)}px` }}>
        <span>{isRefreshing ? 'Refreshing...' : pullDistance > 70 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>

      <main className="content">
        {quickAddOpen && (
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
                <div className="voice-recording-controls">
                  <button type="button" className="inline-action-button" onClick={toggleVoiceRecording}>
                    {isRecording ? 'Stop recording' : 'Record voice'}
                  </button>
                  {formData.voiceRecording && (
                    <audio controls src={formData.voiceRecording} aria-label="Your recorded pronunciation" />
                  )}
                </div>
                {recordingError && <span className="form-help error-text">{recordingError}</span>}
              </label>

              <label>
                <span>Automatic Pronunciation</span>
                <div className="translation-input-row">
                  <input
                    type="text"
                    value={formData.automaticPronunciation}
                    readOnly
                  />
                  <button
                    type="button"
                    className="inline-action-button"
                    onClick={() => lookupWord(formData.word)}
                    disabled={!formData.word}
                    aria-label="Look up pronunciation"
                  >
                    Lookup
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
                  <option value="">Select a Word Type</option>
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
                <button type="button" className="cancel-button" onClick={() => { setQuickAddOpen(false); resetForm() }}>
                  Cancel
                </button>
              </div>
            </form>
          </aside>
        )}

        <section className="panel entries-panel">
          <div className="section-head">
            <div className="library-tab" ref={libraryMenuRef}>
              <button
                type="button"
                className="library-tab-trigger"
                aria-expanded={languageMenuOpen}
                onClick={() => setLanguageMenuOpen((current) => !current)}
              >
                <h2>{selectedLanguage} Library</h2>
                <span aria-hidden="true">{languageMenuOpen ? '\u25b2' : '\u25bc'}</span>
              </button>
              {languageMenuOpen && (
                <div className="library-language-menu language-order-list" role="listbox" aria-label="Reorder languages">
                  {availableLanguages.map((language) => (
                    <div
                      key={language}
                      className={`language-order-item ${language === selectedLanguage ? 'is-selected' : ''}`}
                      draggable
                      onDragStart={() => setDraggedLanguage(language)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleLanguageDrop(language)}
                      onDragEnd={() => setDraggedLanguage(null)}
                    >
                      <button type="button" className="language-order-select" onClick={() => handleLanguageSelect(language)}>
                        <span aria-hidden="true">&#8942;&#8942;</span>
                        {language}
                      </button>
                      <span className="language-reorder-controls">
                        <button type="button" onClick={() => moveLanguage(language, -1)} disabled={availableLanguages.indexOf(language) === 0} aria-label={`Move ${language} up`}>&#8593;</button>
                        <button type="button" onClick={() => moveLanguage(language, 1)} disabled={availableLanguages.indexOf(language) === availableLanguages.length - 1} aria-label={`Move ${language} down`}>&#8595;</button>
                      </span>
                    </div>
                  ))}
                  <button type="button" className="language-order-item add-language-item" onClick={() => handleLanguageSelect('__add_new__')}>
                    + Add new language
                  </button>
                </div>
              )}
            </div>
            <div className="library-actions">
              <span>{filteredEntries.length} words</span>
              <select
                className="word-type-filter"
                value={selectedWordType}
                onChange={(event) => setSelectedWordType(event.target.value)}
                aria-label="Filter by word type"
              >
                <option value="">All word types</option>
                {wordTypeOptions.map((type) => (
                  <option key={type} value={formatWordType(type)}>{formatWordType(type)}</option>
                ))}
              </select>
              <button
                type="button"
                className={`select-entries-button ${selectionMode ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectionMode((current) => !current)
                  setSelectedEntryIds([])
                }}
              >
                {selectionMode ? 'Cancel' : 'Select'}
              </button>
              {selectionMode && (
                <button
                  type="button"
                  className="bulk-delete-button"
                  onClick={handleDeleteSelected}
                  disabled={selectedEntryIds.length === 0}
                >
                  Delete Selected ({selectedEntryIds.length})
                </button>
              )}
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              <p>No terms in this language library yet.</p>
            </div>
          ) : (
            <div className="entries-list">
              {filteredEntries.map((entry) => (
                <article key={entry.id} className="entry-card">
                  {selectionMode && (
                    <label className="entry-selection">
                      <input
                        type="checkbox"
                        checked={selectedEntryIds.includes(entry.id)}
                        onChange={() => toggleEntrySelection(entry.id)}
                      />
                    </label>
                  )}
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
                      <div className="entry-menu">
                        <button
                          type="button"
                          className="entry-menu-button"
                          aria-label={`Open options for ${entry.word}`}
                          aria-expanded={openEntryMenuId === entry.id}
                          onClick={() => setOpenEntryMenuId((current) => current === entry.id ? null : entry.id)}
                        >
                          &#8942;
                        </button>
                        {openEntryMenuId === entry.id && (
                          <div className="entry-menu-list">
                            <button type="button" onClick={() => { handleEdit(entry); setOpenEntryMenuId(null) }}>Edit</button>
                            <button type="button" onClick={() => handleDelete(entry.id)}>Delete</button>
                          </div>
                        )}
                      </div>
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
                        {entry.voiceRecording && (
                          <audio controls src={entry.voiceRecording} aria-label={`Recorded pronunciation for ${entry.word}`} />
                        )}
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

      {studyMode && currentStudyCard && (
        <div className="flashcard-overlay" role="dialog" aria-modal="true" aria-label="Flashcards">
          <div className="study-card">
            <div className="study-header">
              <button type="button" className="close-button" onClick={() => setStudyMode(false)} aria-label="Close flashcards">&times;</button>
            </div>

            <div className="flashcard-navigation">
              <button type="button" className="flashcard-arrow" onClick={() => setStudyIndex((current) => (current - 1 + studyEntries.length) % studyEntries.length)} aria-label="Previous flashcard">&#8592;</button>
              <span>{studyIndex + 1}/{studyEntries.length}</span>
              <button type="button" className="flashcard-arrow" onClick={() => setStudyIndex((current) => (current + 1) % studyEntries.length)} aria-label="Next flashcard">&#8594;</button>
            </div>

            <h3>{currentStudyCard.word}</h3>
            <p className="study-type">{currentStudyCard.wordType}</p>

            <p className="translation">{currentStudyCard.translation || 'Not provided'}</p>
            <dl>
              <div><dt>Definition</dt><dd>{currentStudyCard.definition || 'Not provided'}</dd></div>
              <div><dt>Pronunciation</dt><dd>{currentStudyCard.automaticPronunciation || currentStudyCard.pronunciation || 'Not provided'}</dd></div>
              <div><dt>Example</dt><dd>{currentStudyCard.example || 'Not provided'}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

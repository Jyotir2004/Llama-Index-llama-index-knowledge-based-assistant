import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [activeTab, setActiveTab] = useState(0); // 0: Upload Documents, 1: Raw Text Data
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Raw data state
  const [rawTitle, setRawTitle] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [savingRaw, setSavingRaw] = useState(false);

  // File preview modal state
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const resp = await axios.get(`${API_URL}/api/files`);
      setFiles(resp.data.files || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSelection = () => {
    setSelectedFile(null);
    setError('');
  };

  const handleDeleteFile = async (name) => {
    setError('');
    try {
      await axios.delete(`${API_URL}/api/files/${encodeURIComponent(name)}`);
      await fetchFiles();
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: `Removed ${name} and its indexed chunks from the knowledge hub.` },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || `Could not remove ${name}.`);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedFile(null);
      await fetchFiles();
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Uploaded "${file.name}". The document is chunked, indexed, and ready for questions!`,
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveRawData = async () => {
    const trimmedContent = rawContent.trim();
    if (!trimmedContent) {
      setError('Please enter some text content in the raw data editor.');
      return;
    }

    setSavingRaw(true);
    setError('');

    try {
      const resp = await axios.post(`${API_URL}/api/raw-text`, {
        title: rawTitle.trim(),
        content: trimmedContent,
      });

      const savedName = resp.data.filename;
      setRawTitle('');
      setRawContent('');
      await fetchFiles();
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Saved and indexed raw text "${savedName}". It has been chunked into the vector store and is ready for queries!`,
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save and index raw text.');
    } finally {
      setSavingRaw(false);
    }
  };

  const handlePreview = async (filename) => {
    setPreviewFile(filename);
    setLoadingPreview(true);
    setPreviewContent('');
    try {
      const resp = await axios.get(`${API_URL}/api/files/${encodeURIComponent(filename)}/content`);
      setPreviewContent(resp.data.content || '(Empty file or no readable text)');
    } catch (err) {
      setPreviewContent('Unable to load file content: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
    setQuestion('');

    try {
      const response = await axios.post(`${API_URL}/api/query`, { question: trimmed });
      const answer = response.data.answer || 'No answer available.';
      const sources = response.data.sources || [];
      const sourceText = sources.length ? `\n\nSources: ${sources.join(', ')}` : '';
      setMessages((prev) => [...prev, { sender: 'bot', text: `${answer}${sourceText}` }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Query failed.');
    } finally {
      setLoading(false);
    }
  };

  const getFileBadgeColor = (name) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.txt')) return { label: 'TXT (Raw)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    if (lower.endsWith('.pdf')) return { label: 'PDF', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' };
    if (lower.endsWith('.docx')) return { label: 'DOCX', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' };
    if (lower.endsWith('.csv')) return { label: 'CSV', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)' };
    if (lower.endsWith('.json')) return { label: 'JSON', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' };
    if (lower.endsWith('.md')) return { label: 'MD', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' };
    return { label: 'DOC', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
  };

  const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;
  const charCount = rawContent.length;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%)', color: '#e2e8f0', p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1350, margin: '0 auto' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
          
          {/* Left Column: Knowledge Management (Upload & Raw Text) */}
          <Card sx={{ flex: 1.1, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 4, boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
              
              {/* Header */}
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Box sx={{ p: 1, borderRadius: 2, background: 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex' }}>
                  <MemoryIcon sx={{ color: '#ffffff', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#f8fafc', letterSpacing: '-0.02em' }}>
                    Llama Index Knowledge Hub
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    Vector RAG • HuggingFace MiniLM Embeddings • Groq LLM
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body2" sx={{ color: '#cbd5e1', my: 1.5 }}>
                Feed data to your knowledge base via file uploads or write raw text directly. All content is split into semantic chunks and indexed for retrieval.
              </Typography>

              {/* Navigation Tabs */}
              <Tabs
                value={activeTab}
                onChange={(_, newVal) => setActiveTab(newVal)}
                sx={{
                  minHeight: 44,
                  mb: 2.5,
                  background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: 2.5,
                  p: 0.5,
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTab-root': {
                    minHeight: 38,
                    borderRadius: 2,
                    color: '#94a3b8',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease',
                    '&.Mui-selected': {
                      color: '#ffffff',
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                    },
                  },
                }}
              >
                <Tab icon={<FileUploadIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Upload Documents" />
                <Tab icon={<EditNoteIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Raw Data (.txt)" />
              </Tabs>

              {/* Tab 0: Document Upload */}
              {activeTab === 0 && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ p: 2.5, border: '2px dashed rgba(56, 189, 248, 0.35)', borderRadius: 3, background: 'rgba(15, 23, 42, 0.5)', textAlign: 'center', transition: 'border-color 0.2s', '&:hover': { borderColor: '#38bdf8' } }}>
                    <Typography variant="subtitle2" sx={{ color: '#e2e8f0', fontWeight: 600, mb: 0.5 }}>
                      Select a file from your computer
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 2 }}>
                      Supported formats: PDF, DOCX, TXT, CSV, JSON, MD
                    </Typography>

                    <Button
                      variant="contained"
                      component="label"
                      disabled={uploading}
                      startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <FileUploadIcon />}
                      sx={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', textTransform: 'none', fontWeight: 600, px: 3, py: 1, borderRadius: 2, '&:hover': { background: '#0284c7' } }}
                    >
                      {uploading ? 'Processing & Indexing...' : 'Browse & Upload'}
                      <input
                        hidden
                        type="file"
                        accept=".pdf,.txt,.docx,.csv,.json,.md"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          event.target.value = '';
                          if (file) {
                            setSelectedFile(file);
                            void handleUpload(file);
                          }
                        }}
                      />
                    </Button>

                    {selectedFile && (
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                        <Chip
                          label={uploading ? `Indexing ${selectedFile.name}...` : selectedFile.name}
                          color="primary"
                          variant="outlined"
                          onDelete={uploading ? undefined : handleCancelSelection}
                          deleteIcon={<CloseIcon />}
                          disabled={uploading}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              )}

              {/* Tab 1: Raw Data (.txt) */}
              {activeTab === 1 && (
                <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={rawTitle}
                    onChange={(e) => setRawTitle(e.target.value)}
                    placeholder="Note / File name (e.g. employee_policy.txt, client_notes.txt)"
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        background: '#090e1a',
                        color: '#f1f5f9',
                        borderRadius: 2,
                        fontSize: '0.9rem',
                        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.25)' },
                        '&:hover fieldset': { borderColor: '#38bdf8' },
                      },
                    }}
                    helperText="Optional: If left blank, a timestamped .txt filename will be auto-assigned."
                    FormHelperTextProps={{ sx: { color: '#64748b', fontSize: '0.75rem' } }}
                  />

                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Type or paste your raw text content here...

Anyone can write anything here: meeting minutes, specifications, FAQ entries, notes, or raw articles.

When you click 'Save & Index', this text will be saved as a .txt file in the storage directory, automatically divided into semantic chunks, and embedded into ChromaDB so the bot can answer questions from it."
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        background: '#090e1a',
                        color: '#f8fafc',
                        borderRadius: 2,
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.25)' },
                        '&:hover fieldset': { borderColor: '#38bdf8' },
                      },
                    }}
                  />

                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      {wordCount} words • {charCount} characters
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      {rawContent && (
                        <Button
                          size="small"
                          onClick={() => { setRawTitle(''); setRawContent(''); }}
                          disabled={savingRaw}
                          sx={{ color: '#94a3b8', textTransform: 'none', '&:hover': { color: '#f87171' } }}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        onClick={handleSaveRawData}
                        disabled={savingRaw || !rawContent.trim()}
                        startIcon={savingRaw ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                        sx={{
                          background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                          textTransform: 'none',
                          fontWeight: 600,
                          px: 2.5,
                          borderRadius: 2,
                          '&:hover': { background: '#0284c7' },
                        }}
                      >
                        {savingRaw ? 'Saving & Indexing...' : 'Save & Index Raw Text'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}

              <Divider sx={{ my: 2, borderColor: 'rgba(148, 163, 184, 0.2)' }} />

              {/* Indexed Files Section */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon sx={{ fontSize: 18, color: '#38bdf8' }} />
                  Indexed Knowledge Files ({files.length})
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Chunked in ChromaDB
                </Typography>
              </Box>

              <List dense sx={{ flex: 1, overflowY: 'auto', maxHeight: 280, pr: 0.5 }}>
                {files.length ? (
                  files.map((name) => {
                    const badge = getFileBadgeColor(name);
                    return (
                      <ListItem
                        key={name}
                        sx={{
                          border: '1px solid rgba(148, 163, 184, 0.15)',
                          borderRadius: 2,
                          mb: 1,
                          background: 'rgba(15, 23, 42, 0.6)',
                          transition: 'background 0.2s',
                          '&:hover': { background: 'rgba(30, 41, 59, 0.7)' },
                        }}
                        secondaryAction={
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Tooltip title="View content">
                              <IconButton
                                size="small"
                                edge="end"
                                aria-label={`View ${name}`}
                                onClick={() => handlePreview(name)}
                                sx={{ color: '#38bdf8', '&:hover': { background: 'rgba(56, 189, 248, 0.1)' } }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Remove ${name} and unindex chunks`}>
                              <IconButton
                                size="small"
                                edge="end"
                                aria-label={`Remove ${name}`}
                                onClick={() => handleDeleteFile(name)}
                                sx={{ color: '#f87171', '&:hover': { background: 'rgba(248, 113, 113, 0.1)' } }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }
                      >
                        <Chip
                          label={badge.label}
                          size="small"
                          sx={{
                            mr: 1.5,
                            height: 22,
                            fontSize: '0.675rem',
                            fontWeight: 700,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.color}40`,
                          }}
                        />
                        <ListItemText
                          primary={name}
                          primaryTypographyProps={{
                            sx: {
                              color: '#e2e8f0',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              pr: 4,
                            },
                          }}
                        />
                      </ListItem>
                    );
                  })
                ) : (
                  <ListItem sx={{ border: '1px dashed rgba(148, 163, 184, 0.2)', borderRadius: 2, py: 3, justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      No documents or raw text notes indexed yet.
                    </Typography>
                  </ListItem>
                )}
              </List>

            </CardContent>
          </Card>

          {/* Right Column: Q&A Assistant */}
          <Card sx={{ flex: 1.4, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 4, boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
              
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ p: 1, borderRadius: 2, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex' }}>
                    <SmartToyIcon sx={{ color: '#ffffff', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#f8fafc', lineHeight: 1.2 }}>
                      Ask your Knowledge Base
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      Retrieves answers from uploaded documents and raw text notes
                    </Typography>
                  </Box>
                </Stack>

                {messages.length > 0 && (
                  <Tooltip title="Clear chat history">
                    <Button
                      size="small"
                      startIcon={<RestartAltIcon />}
                      onClick={() => setMessages([])}
                      sx={{ color: '#94a3b8', textTransform: 'none', '&:hover': { color: '#e2e8f0', background: 'rgba(148, 163, 184, 0.1)' } }}
                    >
                      Clear
                    </Button>
                  </Tooltip>
                )}
              </Stack>

              {/* Chat Messages Viewport */}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 460,
                  maxHeight: 560,
                  overflowY: 'auto',
                  background: 'rgba(9, 14, 26, 0.75)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: 3,
                  p: 2.5,
                  mb: 2,
                }}
              >
                {messages.length === 0 ? (
                  <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', p: 3 }}>
                    <SmartToyIcon sx={{ fontSize: 44, mb: 1.5, opacity: 0.5, color: '#a78bfa' }} />
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#cbd5e1' }}>
                      Knowledge Base Ready
                    </Typography>
                    <Typography variant="body2" sx={{ maxWidth: 360, mt: 0.5 }}>
                      Ask questions about any uploaded document or raw text note you added. The system searches through indexed chunks to generate grounded answers.
                    </Typography>
                  </Box>
                ) : (
                  messages.map((msg, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', mb: 2 }}>
                      <Box
                        sx={{
                          maxWidth: '82%',
                          background: msg.sender === 'user' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#1e293b',
                          color: '#f8fafc',
                          borderRadius: 3,
                          px: 2.2,
                          py: 1.5,
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                          border: msg.sender === 'user' ? 'none' : '1px solid rgba(148, 163, 184, 0.15)',
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {msg.text}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}

                {loading && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                    <Box
                      sx={{
                        maxWidth: '82%',
                        background: '#1e293b',
                        color: '#94a3b8',
                        borderRadius: 3,
                        px: 2.2,
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                      }}
                    >
                      <CircularProgress size={18} sx={{ color: '#a78bfa' }} />
                      <Typography variant="body2">
                        Retrieving matching chunks and generating response...
                      </Typography>
                    </Box>
                  </Box>
                )}
                <div ref={chatEndRef} />
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

              {/* Input row */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  fullWidth
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleAsk();
                    }
                  }}
                  placeholder="Ask anything about your documents or raw notes... (Enter to send)"
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: '#090e1a',
                      color: '#f8fafc',
                      borderRadius: 2.5,
                      '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.25)' },
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleAsk}
                  disabled={loading || !question.trim()}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                  sx={{
                    minWidth: 140,
                    background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 2.5,
                    px: 3,
                    '&:hover': { background: '#6d28d9' },
                  }}
                >
                  {loading ? 'Thinking...' : 'Ask'}
                </Button>
              </Stack>

            </CardContent>
          </Card>

        </Stack>
      </Box>

      {/* File Content Preview Dialog */}
      <Dialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DescriptionIcon sx={{ color: '#38bdf8' }} />
            <Typography variant="h6" fontWeight={700}>
              {previewFile}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={() => setPreviewFile(null)} sx={{ color: '#94a3b8' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(148, 163, 184, 0.15)' }}>
          {loadingPreview ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress sx={{ color: '#38bdf8' }} />
            </Box>
          ) : (
            <Box
              sx={{
                background: '#090e1a',
                p: 2.5,
                borderRadius: 2,
                maxHeight: 460,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.6,
                color: '#cbd5e1',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {previewContent}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreviewFile(null)} sx={{ color: '#94a3b8', textTransform: 'none' }}>
            Close Preview
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default App;

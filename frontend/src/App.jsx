import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SearchIcon from '@mui/icons-material/Search';
import MemoryIcon from '@mui/icons-material/Memory';

const API_URL = 'http://localhost:8000';

function App() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
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

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

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
          text: `Uploaded ${selectedFile.name}. The document is now chunked and stored in the vector database.`,
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
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
      setMessages((prev) => [...prev, { sender: 'bot', text: answer }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Query failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #111827 100%)', color: '#e2e8f0', p: 3 }}>
      <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Card sx={{ flex: 1, background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 4, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.4)' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <MemoryIcon sx={{ color: '#38bdf8' }} />
                <Typography variant="h5" fontWeight={800}>RAG Knowledge Hub</Typography>
              </Stack>

              <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 3 }}>
                Upload documents, chunk them, embed them with text-embedding-3-small, and ask questions using retrieved context.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button variant="contained" component="label" startIcon={<FileUploadIcon />} sx={{ background: '#38bdf8', '&:hover': { background: '#0ea5e9' } }}>
                  Upload document
                  <input hidden type="file" onChange={(e) => setSelectedFile(e.target.files[0])} />
                </Button>

                {selectedFile && (
                  <Chip label={selectedFile.name} color="primary" variant="outlined" />
                )}
              </Box>

              {selectedFile && (
                <Button fullWidth variant="outlined" onClick={handleUpload} disabled={uploading} sx={{ mb: 2, borderColor: '#38bdf8', color: '#7dd3fc' }}>
                  {uploading ? 'Uploading...' : 'Store and index file'}
                </Button>
              )}

              <Divider sx={{ my: 2, borderColor: 'rgba(148, 163, 184, 0.25)' }} />

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>Uploaded files</Typography>
              <List dense>
                {files.length ? files.map((name) => (
                  <ListItem key={name} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2, mb: 1 }}>
                    <ListItemText primary={name} sx={{ '& .MuiTypography-root': { color: '#e2e8f0' } }} />
                  </ListItem>
                )) : (
                  <ListItem>
                    <ListItemText primary="No uploads yet" sx={{ '& .MuiTypography-root': { color: '#94a3b8' } }} />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1.4, background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 4, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.4)' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <SmartToyIcon sx={{ color: '#a78bfa' }} />
                <Typography variant="h6" fontWeight={700}>Ask your documents</Typography>
              </Stack>

              <Box sx={{ height: 460, overflowY: 'auto', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 3, p: 2, mb: 2 }}>
                {messages.length === 0 ? (
                  <Typography sx={{ color: '#94a3b8' }}>Ask a question about your uploaded documents...</Typography>
                ) : (
                  messages.map((msg, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
                      <Box sx={{
                        maxWidth: '80%',
                        background: msg.sender === 'user' ? '#2563eb' : '#1e293b',
                        color: '#f8fafc',
                        borderRadius: 3,
                        px: 2,
                        py: 1.2,
                        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.3)',
                      }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                      </Box>
                    </Box>
                  ))
                )}
                <div ref={chatEndRef} />
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  fullWidth
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask anything about your uploaded data..."
                  variant="outlined"
                  sx={{ '& .MuiOutlinedInput-root': { background: '#0f172a', color: '#e2e8f0', borderRadius: 2 } }}
                />
                <Button
                  variant="contained"
                  onClick={handleAsk}
                  disabled={loading}
                  startIcon={<SearchIcon />}
                  sx={{ minWidth: 150, background: '#8b5cf6', '&:hover': { background: '#7c3aed' } }}
                >
                  {loading ? 'Thinking...' : 'Ask'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}

export default App;

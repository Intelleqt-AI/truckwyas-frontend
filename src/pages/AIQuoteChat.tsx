import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postData } from '@/lib/Api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedFields {
  pickup_location?: string;
  delivery_location?: string;
  cargo_description?: string;
  weight?: string;
  vehicle_type?: string;
  urgency?: string;
}

interface QuotePreview extends ExtractedFields {
  distance?: number;
  estimated_cost?: number;
}

export default function AIQuoteChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! Tell me about the load you need to quote. For example: 'I need to move 20 tons of palletised goods from Johannesburg to Cape Town on Friday, flatbed truck.'"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quotePreview, setQuotePreview] = useState<QuotePreview>({});
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Local regex fallback for field extraction
  const extractFieldsLocally = (text: string): Partial<ExtractedFields> => {
    const extracted: Partial<ExtractedFields> = {};
    const lowerText = text.toLowerCase();

    // Extract from X to Y pattern
    const fromToMatch = text.match(/from\s+([^to]+)\s+to\s+([^,.\n]+)/i);
    if (fromToMatch) {
      extracted.pickup_location = fromToMatch[1].trim();
      extracted.delivery_location = fromToMatch[2].trim();
    }

    // Extract weight
    const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|ton|tons|t)/i);
    if (weightMatch) {
      extracted.weight = `${weightMatch[1]} ${weightMatch[2]}`;
    }

    // Extract vehicle type
    const vehicleTypes = ['flatbed', 'tautliner', 'refrigerated', 'tanker', 'box truck', 'curtain side', 'tipper'];
    for (const type of vehicleTypes) {
      if (lowerText.includes(type)) {
        extracted.vehicle_type = type.charAt(0).toUpperCase() + type.slice(1);
        break;
      }
    }

    // Extract city names
    const cities: Record<string, string> = {
      'johannesburg': 'Johannesburg',
      'jhb': 'Johannesburg',
      'cape town': 'Cape Town',
      'cpt': 'Cape Town',
      'durban': 'Durban',
      'dbn': 'Durban',
      'pretoria': 'Pretoria',
      'pta': 'Pretoria',
      'port elizabeth': 'Port Elizabeth',
      'pe': 'Port Elizabeth',
      'bloemfontein': 'Bloemfontein',
      'kimberley': 'Kimberley',
      'nelspruit': 'Nelspruit',
      'polokwane': 'Polokwane',
    };

    for (const [key, value] of Object.entries(cities)) {
      if (lowerText.includes(key)) {
        if (!extracted.pickup_location) {
          extracted.pickup_location = value;
        } else if (!extracted.delivery_location && value !== extracted.pickup_location) {
          extracted.delivery_location = value;
        }
      }
    }

    return extracted;
  };

  // Calculate route once we have pickup and delivery
  const calculateRoute = async (pickup: string, delivery: string) => {
    try {
      const result = await postData({
        url: 'api/v1/route/calculate/',
        data: { origin: pickup, destination: delivery }
      });

      // Backend returns distance_km / total_cost_zar (not distance / estimated_cost).
      const km = result.distance_km ?? result.distance;
      const cost = result.total_cost_zar ?? result.estimated_cost;
      if (km && cost) {
        setQuotePreview(prev => ({
          ...prev,
          distance: km,
          estimated_cost: cost
        }));
      }
    } catch (error) {
      // Route calculation failed, continue without distance/cost
      console.error('Route calculation failed:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message to chat
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      // Try AI backend first
      const response = await postData({
        url: 'api/v1/ai/chat-quote/',
        data: {
          message: userMessage,
          history: messages,
          current_fields: quotePreview
        }
      });

      const aiMessage = response.reply || 'I understand. Let me process that information.';
      const extractedFields = response.extracted_fields || {};

      // Update messages
      setMessages([...newMessages, { role: 'assistant', content: aiMessage }]);

      // Update preview with extracted fields
      const updatedPreview = { ...quotePreview, ...extractedFields };
      setQuotePreview(updatedPreview);

      // Calculate route if we have both locations
      if (updatedPreview.pickup_location && updatedPreview.delivery_location && !updatedPreview.distance) {
        await calculateRoute(updatedPreview.pickup_location, updatedPreview.delivery_location);
      }

    } catch (error: any) {
      // Fallback to local extraction
      const extractedFields = extractFieldsLocally(userMessage);
      const updatedPreview = { ...quotePreview, ...extractedFields };
      setQuotePreview(updatedPreview);

      // Generate fallback response
      let fallbackResponse = 'Got it. ';
      if (extractedFields.pickup_location && extractedFields.delivery_location) {
        fallbackResponse += `So you need to move cargo from ${extractedFields.pickup_location} to ${extractedFields.delivery_location}. `;
      }
      if (extractedFields.weight) {
        fallbackResponse += `Weight is ${extractedFields.weight}. `;
      }
      if (extractedFields.vehicle_type) {
        fallbackResponse += `Vehicle type: ${extractedFields.vehicle_type}. `;
      }
      fallbackResponse += 'What else can you tell me about this load?';

      setMessages([...newMessages, { role: 'assistant', content: fallbackResponse }]);

      // Calculate route if we have both locations
      if (updatedPreview.pickup_location && updatedPreview.delivery_location && !updatedPreview.distance) {
        await calculateRoute(updatedPreview.pickup_location, updatedPreview.delivery_location);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        try {
          setIsLoading(true);
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const response = await postData({
            url: 'api/v1/ai/voice-quote/',
            data: formData,
            config: {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            }
          });

          if (response.transcription) {
            setInput(response.transcription);
            // Auto-send the transcription
            setTimeout(() => {
              setInput(response.transcription);
              handleSend();
            }, 100);
          }
        } catch (error) {
          console.error('Voice transcription failed:', error);
        } finally {
          setIsLoading(false);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      });

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Microphone access denied or not available');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!quotePreview.pickup_location || !quotePreview.delivery_location || !quotePreview.cargo_description) {
      alert('Please provide at least pickup location, delivery location, and cargo description');
      return;
    }

    try {
      setIsLoading(true);
      const result = await postData({
        url: 'api/v1/quotes/',
        data: {
          pickup_location: quotePreview.pickup_location,
          delivery_location: quotePreview.delivery_location,
          cargo_description: quotePreview.cargo_description,
          weight: quotePreview.weight,
          vehicle_type: quotePreview.vehicle_type,
          urgency: quotePreview.urgency,
          distance: quotePreview.distance,
          estimated_cost: quotePreview.estimated_cost
        }
      });

      if (result.id) {
        navigate(`/quotes/${result.id}`);
      } else {
        navigate('/quotes');
      }
    } catch (error: any) {
      console.error('Failed to create quote:', error);
      alert('Failed to create quote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canCreateQuote = Boolean(
    quotePreview.pickup_location &&
    quotePreview.delivery_location &&
    quotePreview.cargo_description
  );

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 120px)',
      gap: 16,
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Left: Chat Panel (65%) */}
      <div style={{
        flex: '0 0 65%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 2,
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-deep)'
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 4
          }}>
            AI Quote Assistant
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 500,
            color: 'var(--text-primary)'
          }}>
            Conversational Quote Creation
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: 2,
                  background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--bg-surface-hover)',
                  color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: 'var(--font-sans)'
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: 2,
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-tertiary)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)'
              }}>
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: 16,
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-deep)',
          display: 'flex',
          gap: 8
        }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            style={{
              background: isRecording ? 'var(--status-danger)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: isRecording ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '10px 14px',
              borderRadius: 2,
              fontSize: 14,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.2s'
            }}
          >
            {isRecording ? '■' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading || isRecording}
            placeholder="Describe the load you need to quote..."
            style={{
              flex: 1,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              borderRadius: 2,
              fontSize: 13,
              outline: 'none',
              fontFamily: 'var(--font-sans)'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isRecording}
            style={{
              background: 'var(--accent-primary)',
              border: 'none',
              color: 'var(--bg-deep)',
              padding: '10px 24px',
              borderRadius: 2,
              fontSize: 11,
              fontWeight: 600,
              cursor: (!input.trim() || isLoading || isRecording) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              opacity: (!input.trim() || isLoading || isRecording) ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            SEND
          </button>
        </div>
      </div>

      {/* Right: Quote Preview (35%) */}
      <div style={{
        flex: '0 0 calc(35% - 16px)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8
            }}>
              QUOTE PREVIEW
            </div>
            <div style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: 16
            }}>
              Extracted Details
            </div>
          </div>

          {/* Field rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <QuoteField
              label="PICKUP"
              value={quotePreview.pickup_location}
              confirmed={Boolean(quotePreview.pickup_location)}
            />
            <QuoteField
              label="DELIVERY"
              value={quotePreview.delivery_location}
              confirmed={Boolean(quotePreview.delivery_location)}
            />
            <QuoteField
              label="CARGO"
              value={quotePreview.cargo_description}
              confirmed={Boolean(quotePreview.cargo_description)}
            />
            <QuoteField
              label="WEIGHT"
              value={quotePreview.weight}
              confirmed={Boolean(quotePreview.weight)}
            />
            <QuoteField
              label="VEHICLE TYPE"
              value={quotePreview.vehicle_type}
              confirmed={Boolean(quotePreview.vehicle_type)}
            />

            {quotePreview.distance && (
              <QuoteField
                label="DISTANCE"
                value={`${quotePreview.distance} km`}
                confirmed={true}
              />
            )}

            {quotePreview.estimated_cost && (
              <QuoteField
                label="EST. COST"
                value={`R ${quotePreview.estimated_cost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                confirmed={true}
                highlight={true}
              />
            )}
          </div>

          {/* Create Quote Button */}
          <button
            onClick={handleCreateQuote}
            disabled={!canCreateQuote || isLoading}
            style={{
              marginTop: 8,
              background: canCreateQuote ? 'var(--status-success)' : 'var(--bg-surface-hover)',
              border: 'none',
              color: canCreateQuote ? 'var(--text-primary)' : 'var(--text-tertiary)',
              padding: '12px 20px',
              borderRadius: 2,
              fontSize: 11,
              fontWeight: 600,
              cursor: canCreateQuote && !isLoading ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'all 0.2s'
            }}
          >
            {isLoading ? 'CREATING...' : 'CREATE QUOTE'}
          </button>

          {!canCreateQuote && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)'
            }}>
              Need: Pickup, Delivery & Cargo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteField({
  label,
  value,
  confirmed,
  highlight = false
}: {
  label: string;
  value?: string;
  confirmed: boolean;
  highlight?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 12px',
      background: 'var(--bg-deep)',
      borderRadius: 2,
      border: '1px solid var(--border-subtle)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 1
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.05em',
          minWidth: 80
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: highlight ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: 12,
          color: value ? (highlight ? 'var(--accent-primary)' : 'var(--text-primary)') : 'var(--text-tertiary)',
          fontWeight: highlight ? 600 : 400
        }}>
          {value || '—'}
        </div>
      </div>
      {confirmed && (
        <div style={{
          color: 'var(--status-success)',
          fontSize: 14
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      )}
    </div>
  );
}

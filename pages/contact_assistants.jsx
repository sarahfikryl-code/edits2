import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Title from "../components/Title";
import { Table, ScrollArea } from '@mantine/core';
import apiClient from "../lib/axios";
import styles from '../styles/TableScrollArea.module.css';

export default function ContactAssistants() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assistants, setAssistants] = useState([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiClient.get("/api/auth/me");
        if (res.status === 200) {
          setHasToken(true);
        } else {
          setHasToken(false);
        }
      } catch (err) {
        setHasToken(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        setIsLoadingAssistants(true);
        const response = await apiClient.get('/api/contact_assistants');
        setAssistants(response.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching assistants:', err);
        setError('Failed to load assistants. Please try again later.');
        setAssistants([]);
      } finally {
        setIsLoadingAssistants(false);
      }
    };
    fetchAssistants();
  }, []);

  // Get first name from full name
  const getFirstName = (fullName) => {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0] || '';
  };

  // Format phone number for WhatsApp (remove any non-numeric characters)
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  // Create WhatsApp message
  const createWhatsAppMessage = (assistantName) => {
    const firstName = getFirstName(assistantName);
    const message = `Hello, ${firstName}. I'm having a problem with the Tony Joseph Demo System. Can you help me?`;
    return encodeURIComponent(message);
  };

  if (loading || isLoadingAssistants) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}>
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            width: "50px",
            height: "50px",
            border: "4px solid rgba(31, 168, 220, 0.2)",
            borderTop: "4px solid #1FA8DC",
            borderRadius: "50%",
            margin: "0 auto 20px",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ color: "#666", fontSize: "1rem" }}>Loading assistants...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px"
    }}>
      <div style={{ 
        maxWidth: 900, 
        margin: "40px auto", 
        padding: "20px"
      }}>
        <Title 
          backText={hasToken ? "Back to Dashboard" : "Back"}
          href={hasToken ? "/student_dashboard" : null}
        >
          Contact Assistants
        </Title>

        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "30px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
        }} className="contact-assistants-container">
          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 600,
              border: '1.5px solid #fca5a5',
              fontSize: '1.1rem',
              boxShadow: '0 4px 16px rgba(220, 53, 69, 0.08)'
            }}>
              {error}
            </div>
          )}

          {assistants.length === 0 && !error ? (
            <div style={{
              padding: '40px 24px',
              background: 'linear-gradient(135deg, rgba(254, 185, 84, 0.1) 0%, rgba(31, 168, 220, 0.1) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(254, 185, 84, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '16px'
              }}>
                😔
              </div>
              <h3 style={{
                color: '#FEB954',
                fontSize: '1.4rem',
                fontWeight: '700',
                marginBottom: '12px',
                marginTop: 0
              }}>
                We're Sorry
              </h3>
              <p style={{
                color: '#495057',
                fontSize: '1rem',
                lineHeight: '1.6',
                margin: 0,
                fontWeight: '500'
              }}>
                Unfortunately, no assistants are available for contact at this time. We apologize for any inconvenience. Please try again later or contact the{' '}
                <a
                  href="/contact_developer"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/contact_developer');
                  }}
                  style={{
                    color: '#1FA8DC',
                    textDecoration: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderBottom: '1px solid #1FA8DC',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#0d5a7a';
                    e.target.style.borderBottomColor = '#0d5a7a';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#1FA8DC';
                    e.target.style.borderBottomColor = '#1FA8DC';
                  }}
                >
                  developer
                </a>
                {' '}for assistance.
              </p>
            </div>
          ) : (
            <>
              {/* Help Note - at the top before table - only show when assistants are available */}
              <div style={{
                marginBottom: '24px',
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(31, 168, 220, 0.08) 0%, rgba(254, 185, 84, 0.08) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(31, 168, 220, 0.2)',
                textAlign: 'center'
              }}>
                <h3 style={{
                  color: '#1FA8DC',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  marginBottom: '12px',
                  marginTop: 0
                }}>
                  Need Help?
                </h3>
                <p style={{
                  color: '#495057',
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Our assistants are here to support you with system access, technical issues, and general questions. Feel free to reach out if you face any problems or need guidance—we're happy to help 😊❤.
                </p>
              </div>

              <ScrollArea h={400} type="hover" className={styles.scrolled}>
                <Table striped highlightOnHover withTableBorder withColumnBorders className="contact-assistants-table">
                  <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                    <Table.Tr>
                      <Table.Th style={{ width: '33%', textAlign: 'center' }}>Name</Table.Th>
                      <Table.Th style={{ width: '33%', textAlign: 'center' }}>Phone No.</Table.Th>
                      <Table.Th style={{ width: '34%', textAlign: 'center' }}>Send WhatsApp</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {assistants.map((assistant) => {
                      const phoneNumber = formatPhoneForWhatsApp(assistant.phone);
                      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${createWhatsAppMessage(assistant.name)}`;
                      
                      return (
                        <Table.Tr key={assistant.id || assistant._id}>
                          <Table.Td style={{ textAlign: 'center', fontWeight: '600' }}>
                            {assistant.name}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                            {assistant.phone}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whatsapp-button-link"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #25d366 0%, #0ee8cf 100%)',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)';
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }} className="whatsapp-icon">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                              Send Message
                            </a>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .contact-assistants-container {
            padding: 20px !important;
          }

          .contact-assistants-table {
            font-size: 0.85rem !important;
          }

          .contact-assistants-table th,
          .contact-assistants-table td {
            padding: 10px 8px !important;
          }

          .whatsapp-button-link {
            padding: 8px 12px !important;
            font-size: 0.85rem !important;
          }

          .whatsapp-icon {
            width: 16px !important;
            height: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .contact-assistants-container {
            padding: 15px !important;
            border-radius: 12px !important;
          }

          .contact-assistants-table {
            font-size: 0.8rem !important;
          }

          .contact-assistants-table th,
          .contact-assistants-table td {
            padding: 8px 6px !important;
          }

          .whatsapp-button-link {
            padding: 6px 10px !important;
            font-size: 0.8rem !important;
            gap: 6px !important;
          }

          .whatsapp-icon {
            width: 14px !important;
            height: 14px !important;
          }
        }

        @media (max-width: 360px) {
          .contact-assistants-table {
            font-size: 0.75rem !important;
          }

          .contact-assistants-table th,
          .contact-assistants-table td {
            padding: 6px 4px !important;
          }

          .whatsapp-button-link {
            padding: 5px 8px !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>
    </div>
  );
}


import { useState } from 'react';
import { generatePublicStudentLink } from '../../lib/generatePublicLink';
import Title from '../../components/Title';
import { useStudents } from '../../lib/api/students';

export default function GenerateLink() {
  const [studentId, setStudentId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [error, setError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  // Get all students for search functionality
  const { data: allStudents } = useStudents({});

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    setError("");
    setSearchResults([]);
    setShowSearchResults(false);
    setGeneratedLink('');
    setSuccessMessage('');
    setShowWarning(false);
    
    const searchTerm = studentId.trim();
    const isAllDigits = /^\d+$/.test(searchTerm);
    const isFullPhone = /^\d{11}$/.test(searchTerm);
    
    // Full phone -> API accepts directly
    if (isFullPhone) {
      if (allStudents) {
        const matchingStudents = allStudents.filter(s =>
          s.phone === searchTerm || s.parentsPhone === searchTerm || s.parents_phone === searchTerm
        );
        if (matchingStudents.length === 1) {
          const student = matchingStudents[0];
          const link = generatePublicStudentLink(student.id.toString());
          setGeneratedLink(link);
          setStudentId(student.id.toString());
          setSelectedStudent(student);
        } else {
          setError(`No student found with phone number ${searchTerm}`);
        }
      } else {
        setError("Student data not loaded. Please try again.");
      }
      return;
    }
    
    // Pure digits, treat as possible ID or partial phone
    if (isAllDigits) {
      if (allStudents) {
        const byId = allStudents.find(s => String(s.id) === searchTerm);
        if (byId) {
          const link = generatePublicStudentLink(String(byId.id));
          setGeneratedLink(link);
          setSelectedStudent(byId);
          return;
        }
        const term = searchTerm;
        const matchingStudents = allStudents.filter(s => {
          const phone = String(s.phone || '').replace(/[^0-9]/g, '');
          const parent = String(s.parents_phone || s.parentsPhone || '').replace(/[^0-9]/g, '');
          return phone.startsWith(term) || parent.startsWith(term);
        });
        if (matchingStudents.length === 1) {
          const foundStudent = matchingStudents[0];
          const link = generatePublicStudentLink(foundStudent.id.toString());
          setGeneratedLink(link);
          setStudentId(foundStudent.id.toString());
          setSelectedStudent(foundStudent);
          return;
        }
        if (matchingStudents.length > 1) {
          setSearchResults(matchingStudents);
          setShowSearchResults(true);
          setError(`Found ${matchingStudents.length} students. Please select one.`);
          return;
        }
      }
      const link = generatePublicStudentLink(searchTerm);
      setGeneratedLink(link);
      setSelectedStudent(null);
      setShowWarning(true);
      return;
    }
    
    // Name search
    if (allStudents) {
      const matchingStudents = allStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (matchingStudents.length === 1) {
        const foundStudent = matchingStudents[0];
        const link = generatePublicStudentLink(foundStudent.id.toString());
        setGeneratedLink(link);
        setStudentId(foundStudent.id.toString());
        setSelectedStudent(foundStudent);
      } else if (matchingStudents.length > 1) {
        setSearchResults(matchingStudents);
        setShowSearchResults(true);
        setError(`Found ${matchingStudents.length} students. Please select one.`);
      } else {
        setError(`No student found matching "${searchTerm}"`);
      }
    } else {
      setError("Student data not loaded. Please try again.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setSuccessMessage('Public link copied to clipboard');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleStudentSelect = (student) => {
    const link = generatePublicStudentLink(student.id.toString());
    setGeneratedLink(link);
    setStudentId(student.id.toString());
    setSelectedStudent(student);
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    if (!value.trim()) {
      setError("");
      setSearchResults([]);
      setShowSearchResults(false);
      setGeneratedLink('');
      setSuccessMessage('');
      setSelectedStudent(null);
      setShowWarning(false);
    }
  };

  return (
    <div style={{ padding: "20px 5px 20px 5px" }}>
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
        <style jsx>{`
          .fetch-form {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 24px;
          }
          .fetch-input {
            flex: 1;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #ffffff;
            color: #000000;
          }
          .fetch-input:focus {
            outline: none;
            border-color: #87CEEB;
            box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
          }
          .fetch-btn {
            background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 140px;
            justify-content: center;
          }
          .fetch-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          }
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .link-container {
            background: rgb(255, 255, 255);
            border-radius: 20px;
            padding: 28px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
            margin-top: 24px;
          }
          .link-title {
            color: rgb(94, 91, 91);
            font-size: 1.4rem;
            font-weight: 800;
            margin-bottom: 20px;
          }
          .link-display {
            background: #ffffff;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #dadddf;
            border-left: 4px solid #1FA8DC;
            word-break: break-all;
            font-size: 15px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
            margin-bottom: 20px;
            color: #2d3748;
          }
          .copy-btn {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 14px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .copy-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.5);
          }
          .success-message {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
          }
          @media (max-width: 768px) {
            .fetch-form {
              flex-direction: column;
            }
            .fetch-btn {
              width: 100%;
            }
          }
        `}</style>

        <Title>Public Link Generator</Title>
        
        <div className="form-container">
          <form onSubmit={handleGenerate} className="fetch-form">
            <input
              className="fetch-input"
              type="text"
              placeholder="Enter Student ID, Name, Phone Number"
              value={studentId}
              onChange={handleIdChange}
              required
            />
            <button type="submit" className="fetch-btn">
              🔗 Generate Link
            </button>
          </form>
          
          {showSearchResults && searchResults.length > 0 && (
            <div style={{ 
              marginTop: "16px", 
              padding: "16px", 
              background: "#f8f9fa", 
              borderRadius: "8px", 
              border: "1px solid #dee2e6" 
            }}>
              <div style={{ marginBottom: "12px", fontWeight: "600", color: "#495057" }}>
                Select a student:
              </div>
              {searchResults.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 16px",
                    margin: "8px 0",
                    background: "white",
                    border: "1px solid #dee2e6",
                    borderRadius: "6px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#e9ecef";
                    e.target.style.borderColor = "#1FA8DC";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "white";
                    e.target.style.borderColor = "#dee2e6";
                  }}
                >
                  <div style={{ fontWeight: "600", color: "#1FA8DC" }}>
                    {student.name} (ID: {student.id})
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#495057", marginTop: 4 }}>
                    <span style={{ fontFamily: 'monospace' }}>{student.phone || 'N/A'}</span>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#6c757d", marginTop: 2 }}>
                    {student.grade} • {student.main_center}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            background: "linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)",
            color: "white",
            borderRadius: "10px",
            padding: "16px",
            marginTop: "16px",
            textAlign: "center",
            fontWeight: "600",
            boxShadow: "0 4px 16px rgba(220, 53, 69, 0.3)"
          }}>
            ❌ {error}
          </div>
        )}

        {selectedStudent && (
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            marginTop: "24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "16px"
            }}>
              <div style={{
                background: "white",
                border: "1px solid #e9ecef",
                borderRadius: "12px",
                padding: "16px",
                borderLeft: "4px solid #1FA8DC"
              }}>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#6c757d", marginBottom: "8px" }}>
                  STUDENT NAME
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#2d3748" }}>
                  {selectedStudent.name || 'N/A'}
                </div>
              </div>

              <div style={{
                background: "white",
                border: "1px solid #e9ecef",
                borderRadius: "12px",
                padding: "16px",
                borderLeft: "4px solid #1FA8DC"
              }}>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#6c757d", marginBottom: "8px" }}>
                  STUDENT PHONE
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#2d3748", fontFamily: "monospace" }}>
                  {selectedStudent.phone || 'N/A'}
                </div>
              </div>

              <div style={{
                background: "white",
                border: "1px solid #e9ecef",
                borderRadius: "12px",
                padding: "16px",
                borderLeft: "4px solid #1FA8DC"
              }}>
                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "#6c757d", marginBottom: "8px" }}>
                  PARENT'S PHONE
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", color: "#2d3748", fontFamily: "monospace" }}>
                  {selectedStudent.parents_phone || selectedStudent.parentsPhone || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {showWarning && generatedLink && (
          <div style={{
            background: "linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)",
            color: "white",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
            textAlign: "center",
            fontWeight: "600"
          }}>
            ⚠️ Warning: This student does not exist. It might have been deleted. This link will not work.
          </div>
        )}

        {generatedLink && (
          <>
            <div className="link-container">
              <div className="link-title">
                🔗 Generated Public Link:
              </div>
              <div className="link-display">
                <strong>{generatedLink}</strong>
              </div>
              <button onClick={copyToClipboard} className="copy-btn">
                📋 Copy Link
              </button>
            </div>
            {successMessage && (
              <div className="success-message">
                ✅ {successMessage}
              </div>
            )}
          </>
        )}

        {generatedLink && selectedStudent && (
          <div style={{
            marginTop: "24px",
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
          }}>
            <div style={{
              fontSize: "1.3rem",
              fontWeight: "700",
              color: "#1FA8DC",
              marginBottom: "20px",
              textAlign: "center"
            }}>
              📱 Send via WhatsApp
            </div>
            
            <table style={{
              width: "100%",
              maxWidth: "600px",
              margin: "0 auto",
              borderCollapse: "collapse"
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "1rem",
                    fontWeight: "600",
                    color: "#495057",
                    borderBottom: "2px solid #1FA8DC",
                    backgroundColor: "#f8f9fa"
                  }}>
                    Send to Student
                  </th>
                  <th style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "1rem",
                    fontWeight: "600",
                    color: "#495057",
                    borderBottom: "2px solid #1FA8DC",
                    backgroundColor: "#f8f9fa"
                  }}>
                    Send to Parent
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{
                    padding: "16px",
                    textAlign: "center",
                    verticalAlign: "middle",
                    borderBottom: "1px solid #e9ecef"
                  }}>
                    {selectedStudent.phone ? (
                      <button
                        onClick={() => {
                          const phoneNumber = selectedStudent.phone.replace(/[^0-9]/g, '');
                          const formattedPhone = phoneNumber.startsWith('01') ? '20' + phoneNumber.substring(1) : phoneNumber;
                          const message = `Tony Joseph Demo attendance system:

Dear ${selectedStudent.name?.split(' ')[0] || 'Student'},
If you want to keep track of your attendance, homework, and quizzes results.
Just click the link below to stay updated:

🖇️ ${generatedLink}

We are always happy to stay in touch 😊❤

– Tony Joseph Demo attendance system`;
                          const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                          window.open(whatsappUrl, '_blank');
                        }}
                        style={{
                          backgroundColor: '#25D366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '12px 20px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: '600',
                          width: '100%',
                          justifyContent: 'center',
                          margin: '0 auto'
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = '#128C7E')}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = '#25D366')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        WhatsApp
                      </button>
                    ) : (
                      <div style={{ color: "#6c757d", fontSize: "0.9rem", fontStyle: "italic" }}>
                        No phone number
                      </div>
                    )}
                  </td>
                  <td style={{
                    padding: "16px",
                    textAlign: "center",
                    verticalAlign: "middle",
                    borderBottom: "1px solid #e9ecef"
                  }}>
                    {(selectedStudent.parents_phone || selectedStudent.parentsPhone) ? (
                      <button
                        onClick={() => {
                          const phoneNumber = (selectedStudent.parents_phone || selectedStudent.parentsPhone).replace(/[^0-9]/g, '');
                          const formattedPhone = phoneNumber.startsWith('01') ? '20' + phoneNumber.substring(1) : phoneNumber;
                          const message = `Tony Joseph Demo attendance system:

Dear ${selectedStudent.name?.split(' ')[0] || 'Student'}'s Parent,
If you'd like to track ${selectedStudent.name?.split(' ')[0] || 'Student'}'s attendance, homework, and quizzes, please visit the link below:

🖇️ ${generatedLink}

We are always happy to stay in touch 😊❤

– Tony Joseph Demo attendance system`;
                          const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
                          window.open(whatsappUrl, '_blank');
                        }}
                        style={{
                          backgroundColor: '#25D366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '12px 20px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: '600',
                          width: '100%',
                          justifyContent: 'center',
                          margin: '0 auto'
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = '#128C7E')}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = '#25D366')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                        WhatsApp
                      </button>
                    ) : (
                      <div style={{ color: "#6c757d", fontSize: "0.9rem", fontStyle: "italic" }}>
                        No phone number
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

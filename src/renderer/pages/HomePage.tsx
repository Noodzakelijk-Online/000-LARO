import { useState, useEffect } from 'react';
import axios from 'axios';
import { getElectronAPI } from "@/lib/electronApiShim";

interface HomePageProps {
  onNavigate: (page: string) => void;
  config: any;
}

interface Case {
  id: string;
  clientName: string;
  caseType: string;
  urgency: string;
  status: string;
  createdAt: string;
}

export default function HomePage({ onNavigate, config }: HomePageProps) {
  const electronAPI = getElectronAPI();
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [autoUpload, setAutoUpload] = useState(true);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Fetch cases from LARO backend
      const response = await axios.get(
        `${config.apiUrl}/api/trpc/cases.list`,
        {
          headers: {
            'Authorization': `Bearer ${config.token}`,
          },
        }
      );

      setCases(response.data.result.data.cases || []);
    } catch (err: any) {
      console.error('Failed to load cases:', err);
      setError('Failed to load cases. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExcludedFolder = async () => {
    const folder = await electronAPI.selectFolder();
    if (folder && !excludedFolders.includes(folder)) {
      setExcludedFolders([...excludedFolders, folder]);
    }
  };

  const handleRemoveExcludedFolder = (folder: string) => {
    setExcludedFolders(excludedFolders.filter(f => f !== folder));
  };

  const handleStartScan = async () => {
    if (!selectedCase) {
      alert('Please select a case first');
      return;
    }

    try {
      // Start scan
      await electronAPI.startScan({
        caseId: selectedCase.id,
        caseName: `${selectedCase.clientName} - ${selectedCase.caseType}`,
        autoUpload,
        excludedFolders,
      });

      // Navigate to scan page
      onNavigate('scan');
    } catch (err: any) {
      console.error('Failed to start scan:', err);
      alert('Failed to start scan: ' + err.message);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence Collection</h1>
          <p className="text-sm text-gray-600">Select a case and configure scan settings</p>
        </div>
        <button
          onClick={() => onNavigate('settings')}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Settings
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Case Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Case</h2>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading cases...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadCases}
                  className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
                >
                  Try Again
                </button>
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <p>No cases found. Create a case in LARO first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedCase?.id === c.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{c.clientName}</h3>
                        <p className="text-sm text-gray-600">{c.caseType}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          c.urgency === 'High' ? 'bg-red-100 text-red-700' :
                          c.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {c.urgency}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scan Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan Settings</h2>
            
            {/* Auto-upload toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <h3 className="font-medium text-gray-900">Automatic Upload</h3>
                <p className="text-sm text-gray-600">Upload files immediately as they are found</p>
              </div>
              <button
                onClick={() => setAutoUpload(!autoUpload)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoUpload ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoUpload ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Excluded folders */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">Excluded Folders</h3>
                <button
                  onClick={handleAddExcludedFolder}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Add Folder
                </button>
              </div>
              
              {excludedFolders.length === 0 ? (
                <p className="text-sm text-gray-600">No folders excluded. All accessible files will be scanned.</p>
              ) : (
                <div className="space-y-2">
                  {excludedFolders.map((folder) => (
                    <div key={folder} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700 truncate flex-1">{folder}</span>
                      <button
                        onClick={() => handleRemoveExcludedFolder(folder)}
                        className="ml-2 text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartScan}
            disabled={!selectedCase}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg"
          >
            {selectedCase ? 'Start Evidence Scan' : 'Select a Case to Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

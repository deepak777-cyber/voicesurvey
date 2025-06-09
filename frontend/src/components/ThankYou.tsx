import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface ThankYouProps {
  onStartNewSurvey: () => void;
}

export const ThankYou: React.FC<ThankYouProps> = ({ onStartNewSurvey }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback has been successfully submitted. We appreciate your
            time and valuable input.
          </p>
          <div className="h-2 bg-green-100 rounded-full mb-6">
            <div className="h-2 bg-green-500 rounded-full w-full animate-pulse"></div>
          </div>
          <Button
            onClick={onStartNewSurvey}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Start New Survey
          </Button>
        </div>
      </div>
    </div>
  );
};

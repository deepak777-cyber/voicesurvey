import { Language } from "@/types/language";

interface Option {
  value: number;
  name: string;
}

interface Question {
  id: string;
  type: "text" | "single-select" | "multi-select" | "rating";
  question: string;
  options?: Option[];
  required: boolean;
}

export const getSurveyQuestions = (language: Language): Question[] => {
  const questions = {
    en: [
      {
        id: "1",
        type: "text",
        question: "What is your name?",
        required: true,
      },
      {
        id: "2",
        type: "single-select",
        question:
          "How would you rate your overall experience with our service?",
        options: [
          { value: 1, name: "Excellent" },
          { value: 2, name: "Good" },
          { value: 3, name: "Average" },
          { value: 4, name: "Poor" },
          { value: 5, name: "Very Poor" },
        ],
        required: true,
      },
      {
        id: "3",
        type: "single-select",
        question: "How satisfied are you with our customer service?",
        options: [
          { value: 1, name: "Very Dissatisfied" },
          { value: 2, name: "Dissatisfied" },
          { value: 3, name: "Neutral" },
          { value: 4, name: "Satisfied" },
          { value: 5, name: "Very Satisfied" },
        ],
        required: true,
      },
      {
        id: "4",
        type: "single-select",
        question: "Do you find Customer Support valuable?",
        options: [
          { value: 1, name: "Yes" },
          { value: 0, name: "No" },
        ],
        required: true,
      },
      {
        id: "5",
        type: "single-select",
        question: "Do you find Easy to Use valuable?",
        options: [
          { value: 1, name: "Yes" },
          { value: 0, name: "No" },
        ],
        required: true,
      },
      {
        id: "6",
        type: "single-select",
        question: "Do you find Good Value valuable?",
        options: [
          { value: 1, name: "Yes" },
          { value: 0, name: "No" },
        ],
        required: true,
      },
      {
        id: "7",
        type: "single-select",
        question: "Do you find Fast Delivery valuable?",
        options: [
          { value: 1, name: "Yes" },
          { value: 0, name: "No" },
        ],
        required: true,
      },
      {
        id: "8",
        type: "single-select",
        question: "Do you find Quality Products valuable?",
        options: [
          { value: 1, name: "Yes" },
          { value: 0, name: "No" },
        ],
        required: true,
      },
      {
        id: "9",
        type: "text",
        question: "What could we do to improve our service?",
        required: false,
      },
      {
        id: "10",
        type: "single-select",
        question: "How did you hear about us?",
        options: [
          { value: 1, name: "Social Media" },
          { value: 2, name: "Friend Referral" },
          { value: 3, name: "Search Engine" },
          { value: 4, name: "Advertisement" },
          { value: 5, name: "Other" },
        ],
        required: true,
      },
    ],
    km: [
      {
        id: "1",
        type: "text",
        question: "តើអ្នកមានឈ្មោះអ្វី?",
        required: true,
      },
      {
        id: "2",
        type: "single-select",
        question:
          "តើអ្នកធ្វើការវាយតម្លៃដូចម្តេចចំពោះបទពិសោធន៍រួមជាមួយសេវាកម្មរបស់យើង?",
        options: [
          { value: 1, name: "ល្អបំផុត" },
          { value: 2, name: "ល្អ" },
          { value: 3, name: "មធ្យម" },
          { value: 4, name: "អន់" },
          { value: 5, name: "អន់ខ្លាំង" },
        ],
        required: true,
      },
      {
        id: "3",
        type: "single-select",
        question: "តើអ្នកពេញចិត្តជាមួយសេវាអតិថិជនរបស់យើងយ៉ាងដូចម្តេច?",
        options: [
          { value: 1, name: "មិនពេញចិត្តខ្លាំង" },
          { value: 2, name: "មិនពេញចិត្ត" },
          { value: 3, name: "មធ្យម" },
          { value: 4, name: "ពេញចិត្ត" },
          { value: 5, name: "ពេញចិត្តខ្លាំង" },
        ],
        required: true,
      },
      {
        id: "4",
        type: "single-select",
        question: "តើអ្នកគិតថាសេវាផ្តល់ជំនួយអតិថិជនមានតម្លៃឬទេ?",
        options: [
          { value: 1, name: "បាទ/ចាស" },
          { value: 0, name: "ទេ" },
        ],
        required: true,
      },
      {
        id: "5",
        type: "single-select",
        question: "តើអ្នកគិតថាការប្រើប្រាស់ងាយស្រួលមានតម្លៃឬទេ?",
        options: [
          { value: 1, name: "បាទ/ចាស" },
          { value: 0, name: "ទេ" },
        ],
        required: true,
      },
      {
        id: "6",
        type: "single-select",
        question: "តើអ្នកគិតថាតម្លៃល្អមានតម្លៃឬទេ?",
        options: [
          { value: 1, name: "បាទ/ចាស" },
          { value: 0, name: "ទេ" },
        ],
        required: true,
      },
      {
        id: "7",
        type: "single-select",
        question: "តើអ្នកគិតថាការដឹកជញ្ជូនលឿនមានតម្លៃឬទេ?",
        options: [
          { value: 1, name: "បាទ/ចាស" },
          { value: 0, name: "ទេ" },
        ],
        required: true,
      },
      {
        id: "8",
        type: "single-select",
        question: "តើអ្នកគិតថាផលិតផលដែលមានគុណភាពមានតម្លៃឬទេ?",
        options: [
          { value: 1, name: "បាទ/ចាស" },
          { value: 0, name: "ទេ" },
        ],
        required: true,
      },
      {
        id: "9",
        type: "text",
        question: "តើយើងអាចធ្វើអ្វីដើម្បីធ្វើឲ្យសេវាកម្មរបស់យើងប្រសើរឡើង?",
        required: false,
      },
      {
        id: "10",
        type: "single-select",
        question: "តើអ្នកបានដឹងអំពីយើងដោយរបៀបណា?",
        options: [
          { value: 1, name: "បណ្តាញសង្គម" },
          { value: 2, name: "មិត្តភក្តិណែនាំ" },
          { value: 3, name: "ម៉ាស៊ីនស្វែងរក" },
          { value: 4, name: "ពាណិជ្ជកម្ម" },
          { value: 5, name: "ផ្សេងទៀត" },
        ],
        required: true,
      },
    ],
  };

  return questions[language];
};

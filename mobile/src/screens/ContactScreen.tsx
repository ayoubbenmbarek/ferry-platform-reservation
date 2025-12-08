import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import api, { getErrorMessage } from '../services/api';
import { colors, spacing, borderRadius } from '../constants/theme';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  bookingReference: string;
}

const categories = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'booking', label: 'Booking Support' },
  { value: 'refund', label: 'Refunds & Cancellations' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'feedback', label: 'Feedback & Suggestions' },
  { value: 'other', label: 'Other' },
];

export default function ContactScreen() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    message: '',
    bookingReference: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!formData.subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    if (!formData.message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/contact', formData);
      Alert.alert(
        'Message Sent',
        'Thank you for contacting us. We\'ll respond to your inquiry within 24 hours.',
        [{ text: 'OK' }]
      );
      // Clear form
      setFormData({
        name: '',
        email: '',
        subject: '',
        category: 'general',
        message: '',
        bookingReference: '',
      });
    } catch (error: any) {
      Alert.alert('Error', getErrorMessage(error) || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCall = () => {
    Linking.openURL('tel:+21671123456');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@ferryreservation.com');
  };

  const handleMap = () => {
    const address = '123 Marina Boulevard, La Goulette, Tunis 2060, Tunisia';
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
    });
    if (url) Linking.openURL(url);
  };

  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || 'General Inquiry';
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Contact Options */}
          <View style={styles.quickContactSection}>
            <Text style={styles.sectionTitle}>Quick Contact</Text>
            <View style={styles.quickContactGrid}>
              <TouchableOpacity style={styles.quickContactCard} onPress={handleCall}>
                <View style={[styles.quickContactIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="call" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.quickContactLabel}>Call Us</Text>
                <Text style={styles.quickContactValue}>+216 71 123 456</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickContactCard} onPress={handleEmail}>
                <View style={[styles.quickContactIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="mail" size={24} color="#2196F3" />
                </View>
                <Text style={styles.quickContactLabel}>Email</Text>
                <Text style={styles.quickContactValue}>support@ferry...</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickContactCard} onPress={handleMap}>
                <View style={[styles.quickContactIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="location" size={24} color="#FF9800" />
                </View>
                <Text style={styles.quickContactLabel}>Visit Us</Text>
                <Text style={styles.quickContactValue}>La Goulette</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Business Hours */}
          <Card style={styles.hoursCard}>
            <Card.Content>
              <View style={styles.hoursHeader}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.hoursTitle}>Business Hours</Text>
              </View>
              <View style={styles.hoursRow}>
                <Text style={styles.hoursDay}>Monday - Friday</Text>
                <Text style={styles.hoursTime}>8:00 AM - 6:00 PM</Text>
              </View>
              <View style={styles.hoursRow}>
                <Text style={styles.hoursDay}>Saturday</Text>
                <Text style={styles.hoursTime}>9:00 AM - 2:00 PM</Text>
              </View>
              <View style={styles.hoursRow}>
                <Text style={styles.hoursDay}>Sunday</Text>
                <Text style={[styles.hoursTime, { color: colors.error }]}>Closed</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Contact Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Send us a Message</Text>
            <Text style={styles.formSubtitle}>
              Fill out the form below and we'll get back to you within 24 hours.
            </Text>

            <View style={styles.formFields}>
              <TextInput
                label="Full Name *"
                value={formData.name}
                onChangeText={(text) => handleInputChange('name', text)}
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="account" />}
              />

              <TextInput
                label="Email Address *"
                value={formData.email}
                onChangeText={(text) => handleInputChange('email', text)}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                left={<TextInput.Icon icon="email" />}
              />

              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <View style={styles.pickerButtonContent}>
                  <Ionicons name="list-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.pickerTextContainer}>
                    <Text style={styles.pickerLabel}>Category</Text>
                    <Text style={styles.pickerValue}>{getCategoryLabel(formData.category)}</Text>
                  </View>
                  <Ionicons
                    name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {showCategoryPicker && (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.category}
                    onValueChange={(value) => {
                      handleInputChange('category', value);
                      setShowCategoryPicker(false);
                    }}
                  >
                    {categories.map((cat) => (
                      <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
                    ))}
                  </Picker>
                </View>
              )}

              <TextInput
                label="Booking Reference (optional)"
                value={formData.bookingReference}
                onChangeText={(text) => handleInputChange('bookingReference', text)}
                mode="outlined"
                style={styles.input}
                placeholder="e.g., BK-ABC123"
                left={<TextInput.Icon icon="ticket" />}
              />

              <TextInput
                label="Subject *"
                value={formData.subject}
                onChangeText={(text) => handleInputChange('subject', text)}
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="text" />}
              />

              <TextInput
                label="Message *"
                value={formData.message}
                onChangeText={(text) => handleInputChange('message', text)}
                mode="outlined"
                multiline
                numberOfLines={6}
                style={[styles.input, styles.messageInput]}
              />

              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.submitButton}
                contentStyle={styles.submitButtonContent}
                icon="send"
              >
                Send Message
              </Button>
            </View>
          </View>

          {/* Live Chat Info */}
          <Card style={styles.chatCard}>
            <Card.Content>
              <View style={styles.chatContent}>
                <View style={styles.chatIconContainer}>
                  <Ionicons name="chatbubbles" size={32} color="#fff" />
                </View>
                <View style={styles.chatTextContainer}>
                  <Text style={styles.chatTitle}>Need Immediate Help?</Text>
                  <Text style={styles.chatSubtitle}>
                    Our AI-powered support chatbot is available 24/7. Look for the chat icon!
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  quickContactSection: {
    marginBottom: spacing.lg,
  },
  quickContactGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickContactCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  quickContactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickContactLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  quickContactValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  hoursCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  hoursTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  hoursDay: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  hoursTime: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  formSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  formFields: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
  },
  messageInput: {
    height: 120,
  },
  pickerButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pickerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pickerValue: {
    fontSize: 16,
    color: colors.text,
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginTop: -spacing.sm,
  },
  submitButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  submitButtonContent: {
    paddingVertical: spacing.xs,
  },
  chatCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  chatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  chatIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTextContainer: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  chatSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
});

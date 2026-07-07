export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admission: {
        Row: {
          admitted_at: string
          discharged_at: string | null
          id: string
          note: string | null
          patient_id: string
          status: string
        }
        Insert: {
          admitted_at?: string
          discharged_at?: string | null
          id?: string
          note?: string | null
          patient_id: string
          status?: string
        }
        Update: {
          admitted_at?: string
          discharged_at?: string | null
          id?: string
          note?: string | null
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
      }
      drug: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          spec: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          spec?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          spec?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      invite: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          owner_id: string | null
          referring_hospital_id: string | null
          role: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          owner_id?: string | null
          referring_hospital_id?: string | null
          role: string
          token: string
          used?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          owner_id?: string | null
          referring_hospital_id?: string | null
          role?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invite_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_referring_hospital_id_fkey"
            columns: ["referring_hospital_id"]
            isOneToOne: false
            referencedRelation: "referring_hospital"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          file_name: string | null
          id: string
          kind: string | null
          patient_id: string
          storage_path: string
          uploaded_at: string
          visit_id: string | null
        }
        Insert: {
          file_name?: string | null
          id?: string
          kind?: string | null
          patient_id: string
          storage_path: string
          uploaded_at?: string
          visit_id?: string | null
        }
        Update: {
          file_name?: string | null
          id?: string
          kind?: string | null
          patient_id?: string
          storage_path?: string
          uploaded_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_image: {
        Row: {
          file_name: string | null
          id: string
          modality: string | null
          storage_path: string
          uploaded_at: string
          visit_id: string
        }
        Insert: {
          file_name?: string | null
          id?: string
          modality?: string | null
          storage_path: string
          uploaded_at?: string
          visit_id: string
        }
        Update: {
          file_name?: string | null
          id?: string
          modality?: string | null
          storage_path?: string
          uploaded_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_image_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["id"]
          },
        ]
      }
      owner: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      patient: {
        Row: {
          birth_date: string | null
          breed: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          owner_id: string
          referring_hospital_id: string | null
          sex: string | null
          species: string | null
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          owner_id: string
          referring_hospital_id?: string | null
          sex?: string | null
          species?: string | null
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          owner_id?: string
          referring_hospital_id?: string | null
          sex?: string | null
          species?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_referring_hospital_id_fkey"
            columns: ["referring_hospital_id"]
            isOneToOne: false
            referencedRelation: "referring_hospital"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription: {
        Row: {
          dose: string | null
          drug_id: string
          duration: string | null
          frequency: string | null
          id: string
          note: string | null
          visit_id: string
        }
        Insert: {
          dose?: string | null
          drug_id: string
          duration?: string | null
          frequency?: string | null
          id?: string
          note?: string | null
          visit_id: string
        }
        Update: {
          dose?: string | null
          drug_id?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          note?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          id: string
          name: string | null
          owner_id: string | null
          referring_hospital_id: string | null
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
          owner_id?: string | null
          referring_hospital_id?: string | null
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          owner_id?: string | null
          referring_hospital_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_referring_hospital_id_fkey"
            columns: ["referring_hospital_id"]
            isOneToOne: false
            referencedRelation: "referring_hospital"
            referencedColumns: ["id"]
          },
        ]
      }
      referring_hospital: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      visit: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          patient_id: string
          visit_date: string
          visit_no: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          patient_id: string
          visit_date?: string
          visit_no?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          patient_id?: string
          visit_date?: string
          visit_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
      }
      vital: {
        Row: {
          admission_id: string
          diastolic: number | null
          heart_rate: number | null
          id: string
          measured_at: string
          note: string | null
          recorded_by: string | null
          resp_rate: number | null
          systolic: number | null
          temperature: number | null
        }
        Insert: {
          admission_id: string
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          measured_at?: string
          note?: string | null
          recorded_by?: string | null
          resp_rate?: number | null
          systolic?: number | null
          temperature?: number | null
        }
        Update: {
          admission_id?: string
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          measured_at?: string
          note?: string | null
          recorded_by?: string | null
          resp_rate?: number | null
          systolic?: number | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vital_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admission"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_hospital_id: { Args: never; Returns: string }
      current_owner_id: { Args: never; Returns: string }
      current_role_name: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

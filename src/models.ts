import { createSchema, Type, typedModel,ExtractDoc, ExtractProps } from 'ts-mongoose';
const PersonSchema = createSchema(
  {
    name: Type.string({ required: true }),
    email: Type.string({unique: true, required: true, index: true}),
    points: Type.number({default: 0, required: true, index:true})
  },
  { _id: true, timestamps: true }
);
export const Person = typedModel('Person', PersonSchema, undefined, undefined, {
  /**
   * @deprecated
   * @param email the email your finding.
   */
  findByEmail: function(email: string) {
    return this.find({ email });
  }
});
export type PersonDoc = ExtractDoc<typeof PersonSchema>;
export type PersonProps = ExtractProps<typeof PersonSchema>;


const MatchSchema = createSchema(
  {
    name: Type.string({required: true}),
    people: Type.array().of(Type.ref(Type.objectId()).to('Person', PersonSchema)),
    points: Type.number({ required: true })
  },
  { _id: true, timestamps: true }
);
export const Match = typedModel('Match', MatchSchema);
export type MatchDoc = ExtractDoc<typeof MatchSchema>;
export type MatchProps = ExtractProps<typeof MatchSchema>;

const RedditPostSchema = createSchema({
  postId: Type.string({required:true, index: true}),
  subId: Type.string({required: true, index: true})
},{ _id: true, timestamps: true });
export const RedditPost = typedModel('RedditPost', RedditPostSchema);
export type RedditPostDoc = ExtractDoc<typeof RedditPostSchema>;
export type RedditPostProps = ExtractProps<typeof RedditPostSchema>;

const KeyValueSchema = createSchema({
  key: Type.string({required:true, index: true, unique: true}),
  value: Type.string({required: true, index: false})
},{ _id: true, timestamps: false });
export const KeyValue = typedModel('KeyValue', KeyValueSchema);
export type KeyValueDoc = ExtractDoc<typeof KeyValueSchema>;
export type KeyValueProps = ExtractProps<typeof KeyValueSchema>;
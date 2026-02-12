import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const todayTasks = [
  { id: 'math', name: '数学', due: 12 },
  { id: 'english', name: '英语', due: 8 },
  { id: 'history', name: '历史', due: 5 },
];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home · 今日复习</Text>
      {todayTasks.map((task) => (
        <Link key={task.id} href={`/review/${task.id}`} style={styles.card}>
          {task.name}：待复习 {task.due} 张
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#f2f4f7',
    borderRadius: 12,
    fontSize: 16,
    overflow: 'hidden',
    padding: 14,
  },
});

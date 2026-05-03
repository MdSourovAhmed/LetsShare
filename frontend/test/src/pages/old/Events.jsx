import EventList from '../components/EventList';

const Events = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Upcoming Events</h1>
      <EventList />
    </div>
  );
};

export default Events;